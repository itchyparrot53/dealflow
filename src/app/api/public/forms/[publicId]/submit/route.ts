import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { ERROR_IDS } from "@/constants/errorIds";
import { FORM_BODY_MAX_BYTES, FORM_SUBMIT_PER_MINUTE } from "@/constants/formsBooking";
import { FORM_COPY } from "@/constants/formsBookingStrings";
import { db } from "@/db/client";
import { submitForm } from "@/features/forms/submit";
import { clientIp } from "@/features/net/clientIp";
import { createRateLimiter, type RateLimiter } from "@/server/rateLimit";

// Public form submit. No session and deliberately no same-origin check: the form is embedded on
// other sites, so the origin is not ours. The signed token, the honeypot, the rate limit and the
// validated body are what this endpoint trusts instead.

const submitBodySchema = z.object({
  values: z.record(z.string(), z.unknown()).default({}),
  website: z.string().optional(),
  token: z.string().default(""),
});

const RATE_WINDOW_MS = 60_000;

function newLimiter(): RateLimiter {
  return createRateLimiter({ limit: FORM_SUBMIT_PER_MINUTE, windowMs: RATE_WINDOW_MS });
}

let limiter = newLimiter();

// Tests drive the window explicitly, so each case starts clean.
export function resetFormRateLimitForTest(): void {
  limiter = newLimiter();
}

function statusFor(errorId: string): number {
  if (errorId === ERROR_IDS.FORM_NOT_FOUND) return 404;
  if (errorId === ERROR_IDS.FORM_SUBMISSION_INVALID) return 422;
  if (errorId === ERROR_IDS.FORM_RATE_LIMITED) return 429;
  return 400;
}

function fail(
  errorId: string,
  status = statusFor(errorId),
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ error: errorId, ...extra }, { status });
}

function isFormEncoded(req: NextRequest): boolean {
  return (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
}

function parseBody(
  raw: string,
  formEncoded: boolean,
): { ok: true; body: z.infer<typeof submitBodySchema> } | { ok: false } {
  if (formEncoded) {
    const params = new URLSearchParams(raw);
    const values: Record<string, string> = {};
    for (const [key, value] of params) {
      if (key !== "website" && key !== "token") values[key] = value;
    }
    return {
      ok: true,
      body: {
        values,
        website: params.get("website") ?? undefined,
        token: params.get("token") ?? "",
      },
    };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const body = submitBodySchema.safeParse(parsed);
    return body.success ? { ok: true, body: body.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> },
): Promise<Response> {
  const { publicId } = await ctx.params;
  const formEncoded = isFormEncoded(req);

  const ip = clientIp(req.headers);
  const now = Date.now();
  const byIp = limiter.check(`ip:${ip}`, now);
  const byForm = limiter.check(`form:${publicId}`, now);
  if (!byIp.allowed || !byForm.allowed) {
    const response = fail(ERROR_IDS.FORM_RATE_LIMITED);
    response.headers.set(
      "Retry-After",
      String(Math.max(byIp.retryAfterSeconds, byForm.retryAfterSeconds)),
    );
    return response;
  }

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > FORM_BODY_MAX_BYTES) {
    return fail(ERROR_IDS.FORM_INPUT_INVALID, 413);
  }
  const parsed = parseBody(raw, formEncoded);
  if (!parsed.ok) return fail(ERROR_IDS.FORM_INPUT_INVALID);

  const result = await submitForm(db, publicId, parsed.body, now, AbortSignal.timeout(10_000));
  if (!result.ok) {
    const error = result.error;
    return fail(error.id, statusFor(error.id), error.context ?? {});
  }

  // The no-JavaScript path: a classic form post lands back on the page with its success state.
  if (formEncoded) {
    return NextResponse.redirect(`${env.BASE_URL}/f/${publicId}?done=1`, { status: 303 });
  }
  return NextResponse.json({
    ok: true,
    message: result.value.message || FORM_COPY.thanks,
    redirectUrl: result.value.redirectUrl,
  });
}
