import { and, eq, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS, type ErrorId } from "@/constants/errorIds";
import { API_BODY_MAX_BYTES, API_RATE_PER_MINUTE } from "@/constants/projectsApi";
import { db } from "@/db/client";
import { apiTokens } from "@/db/schema";
import { hydrateActor } from "@/server/hydrateActor";
import { createRateLimiter } from "@/server/rateLimit";
import { matchRoute } from "./registry";
import { statusForError } from "./status";
import { hashApiToken, parseBearer } from "./tokenFormat";
import type { ApiMethod, ApiRoute } from "./types";

// The bearer-token API pipeline (6.7): parse the token, look it up by hash, hydrate its user as
// the actor, check scope, rate-limit per token, validate the route's query/body with Zod, then run
// the handler. There is no cookie path: a request with a session cookie and no bearer header is
// refused with E_API_001.

let limiter = createRateLimiter({ limit: API_RATE_PER_MINUTE, windowMs: 60_000 });

export function resetApiRateLimiterForTest(): void {
  limiter = createRateLimiter({ limit: API_RATE_PER_MINUTE, windowMs: 60_000 });
}

function json(body: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function errorBody(id: ErrorId, message: string): { error: { id: string; message: string } } {
  return { error: { id, message } };
}

interface Authed {
  tokenId: string;
  userId: string;
  scope: "read" | "write";
}

async function authenticate(req: Request, signal: AbortSignal): Promise<Authed | Response> {
  const bearer = parseBearer(req.headers.get("authorization"));
  if (bearer === null) {
    return json(errorBody(ERROR_IDS.API_TOKEN_MISSING, "missing or malformed bearer token"), 401);
  }
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashApiToken(bearer)), isNull(apiTokens.revokedAt)));
  signal.throwIfAborted();
  const now = Date.now();
  if (row === undefined) {
    return json(errorBody(ERROR_IDS.API_TOKEN_INVALID, "unknown or revoked token"), 401);
  }
  if (row.expiresAt !== null && row.expiresAt.getTime() <= now) {
    return json(errorBody(ERROR_IDS.API_TOKEN_INVALID, "expired token"), 401);
  }
  const actor = await hydrateActor(db, row.userId, signal);
  if (actor === null) {
    return json(errorBody(ERROR_IDS.API_TOKEN_INVALID, "token owner is inactive"), 401);
  }
  // last_used_at is a coarse signal, so write it at most once a minute.
  if (row.lastUsedAt === null || now - row.lastUsedAt.getTime() >= 60_000) {
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(apiTokens.id, row.id));
  }
  return { tokenId: row.id, userId: row.userId, scope: row.scope === "write" ? "write" : "read" };
}

function readBody(
  raw: string,
  route: ApiRoute,
): { ok: true; body: unknown } | { ok: false; response: Response } {
  if (raw === "") return { ok: true, body: undefined };
  if (new TextEncoder().encode(raw).length > API_BODY_MAX_BYTES) {
    return {
      ok: false,
      response: json(errorBody(ERROR_IDS.API_BODY_INVALID, "request body too large"), 422),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: json(errorBody(ERROR_IDS.API_BODY_INVALID, "body is not valid JSON"), 422),
    };
  }
  if (route.body === undefined) return { ok: true, body: parsed };
  const checked = route.body.safeParse(parsed);
  if (!checked.success) {
    return {
      ok: false,
      response: json(
        {
          error: {
            id: ERROR_IDS.API_BODY_INVALID,
            message: "invalid body",
            issues: checked.error.issues,
          },
        },
        422,
      ),
    };
  }
  return { ok: true, body: checked.data };
}

function checkedQuery(
  route: ApiRoute,
  raw: Record<string, string>,
): { ok: true; query: unknown } | { ok: false; response: Response } {
  if (route.query === undefined) return { ok: true, query: raw };
  const checked = route.query.safeParse(raw);
  if (checked.success) return { ok: true, query: checked.data };
  return {
    ok: false,
    response: json(
      {
        error: {
          id: ERROR_IDS.API_BODY_INVALID,
          message: "invalid query",
          issues: checked.error.issues,
        },
      },
      422,
    ),
  };
}

async function parseRequest(
  req: Request,
  route: ApiRoute,
  method: ApiMethod,
): Promise<{ ok: true; query: unknown; body: unknown } | { ok: false; response: Response }> {
  const query = checkedQuery(route, Object.fromEntries(new URL(req.url).searchParams.entries()));
  if (!query.ok) return query;
  if (method !== "POST" && method !== "PATCH") {
    return { ok: true, query: query.query, body: undefined };
  }
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return {
      ok: false,
      response: json(
        errorBody(ERROR_IDS.API_BODY_INVALID, "content type must be application/json"),
        422,
      ),
    };
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > API_BODY_MAX_BYTES) {
    return {
      ok: false,
      response: json(errorBody(ERROR_IDS.API_BODY_INVALID, "request body too large"), 422),
    };
  }
  const parsed = readBody(await req.text(), route);
  if (!parsed.ok) return { ok: false, response: parsed.response };
  return { ok: true, query: query.query, body: parsed.body };
}

function routeFailure(matched: ReturnType<typeof matchRoute>): Response | null {
  if (matched.kind === "none") {
    return json(errorBody(ERROR_IDS.API_ROUTE_NOT_FOUND, "unknown route"), 404);
  }
  if (matched.kind === "method") {
    return json(errorBody(ERROR_IDS.API_ROUTE_NOT_FOUND, "method not allowed"), 405);
  }
  return null;
}

export async function handleApiRequest(
  req: Request,
  method: ApiMethod,
  segments: string[],
): Promise<Response> {
  const signal = AbortSignal.timeout(20_000);
  try {
    const authed = await authenticate(req, signal);
    if (authed instanceof Response) return authed;

    if (method !== "GET" && authed.scope !== "write") {
      return json(errorBody(ERROR_IDS.API_SCOPE_DENIED, "this token is read-only"), 403);
    }

    const limited = limiter.check(authed.tokenId, Date.now());
    if (!limited.allowed) {
      return json(errorBody(ERROR_IDS.API_RATE_LIMITED, "rate limit exceeded"), 429, {
        "Retry-After": String(limited.retryAfterSeconds),
      });
    }

    const matched = matchRoute(method, segments);
    if (matched.kind !== "match") {
      return (
        routeFailure(matched) ?? json(errorBody(ERROR_IDS.DB_INVARIANT, "internal error"), 500)
      );
    }

    const parsedRequest = await parseRequest(req, matched.route, method);
    if (!parsedRequest.ok) return parsedRequest.response;

    const actor = await hydrateActor(db, authed.userId, signal);
    if (actor === null) {
      return json(errorBody(ERROR_IDS.API_TOKEN_INVALID, "token owner is inactive"), 401);
    }
    const result = await matched.route.handler(
      { db, actor, tokenId: authed.tokenId },
      matched.params,
      parsedRequest.query,
      parsedRequest.body,
      signal,
    );
    if (!result.ok) {
      return json(
        errorBody(result.error.id, result.error.message),
        statusForError(result.error.id),
      );
    }
    return json(result.value, method === "POST" ? 201 : 200);
  } catch (error) {
    if (error instanceof AppError) {
      return json(errorBody(error.id, error.message), statusForError(error.id));
    }
    console.error("api handler error", error);
    return json(errorBody(ERROR_IDS.DB_INVARIANT, "internal error"), 500);
  }
}
