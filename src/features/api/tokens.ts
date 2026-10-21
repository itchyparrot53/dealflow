import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { apiTokens, users } from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { newApiToken } from "./tokenFormat";

// Personal API tokens. The plain token leaves the server exactly once (createToken); every read
// returns only the display prefix, never the hash or the token itself. An admin may list and
// revoke any token, a user only their own.

export interface TokenView {
  id: string;
  name: string;
  prefix: string;
  scope: "read" | "write";
  userId: string;
  userName: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export const createTokenInput = z.object({
  name: z.string().trim().min(1).max(80),
  scope: z.enum(["read", "write"]),
  expiresInDays: z
    .union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)])
    .nullable()
    .optional(),
});

type TokenRow = typeof apiTokens.$inferSelect;

function view(row: TokenRow, userName: string): TokenView {
  return {
    id: row.id,
    name: row.name,
    prefix: row.tokenPrefix,
    scope: row.scope === "write" ? "write" : "read",
    userId: row.userId,
    userName,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

function invalid(issues: unknown): AppError {
  return new AppError(ERROR_IDS.API_BODY_INVALID, "invalid token input", { issues });
}

export async function listTokens(
  db: Db,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<TokenView[]> {
  signal.throwIfAborted();
  const base = db
    .select({ token: apiTokens, userName: users.name })
    .from(apiTokens)
    .leftJoin(users, eq(users.id, apiTokens.userId));
  const rows =
    actor.type === "admin"
      ? await base.orderBy(desc(apiTokens.createdAt))
      : await base.where(eq(apiTokens.userId, actor.id)).orderBy(desc(apiTokens.createdAt));
  signal.throwIfAborted();
  return rows.map((row) => view(row.token, row.userName ?? row.token.userId));
}

export async function createToken(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ token: string; view: TokenView }, AppError>> {
  const parsed = createTokenInput.safeParse(raw);
  if (!parsed.success) return err(invalid(parsed.error.issues));
  const created = newApiToken();
  const days = parsed.data.expiresInDays ?? null;
  const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  signal.throwIfAborted();
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: actor.id,
      name: parsed.data.name,
      tokenHash: created.hash,
      tokenPrefix: created.prefix,
      scope: parsed.data.scope,
      expiresAt,
    })
    .returning();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "createToken: insert returned no rows");
  }
  return ok({ token: created.token, view: view(row, actor.id) });
}

export async function revokeToken(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<TokenView, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ token: apiTokens, userName: users.name })
    .from(apiTokens)
    .leftJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.id, id));
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.API_TOKEN_INVALID, "token not found", { id }));
  }
  if (actor.type !== "admin" && row.token.userId !== actor.id) {
    // No existence leak: a token of someone else reads as unknown.
    return err(new AppError(ERROR_IDS.API_TOKEN_INVALID, "token not found", { id }));
  }
  if (row.token.revokedAt !== null) return ok(view(row.token, row.userName ?? row.token.userId));

  const [revoked] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.id, id))
    .returning();
  if (revoked === undefined) {
    throw new AppError(ERROR_IDS.DB_INVARIANT, "revokeToken: update returned no rows");
  }
  return ok(view(revoked, row.userName ?? revoked.userId));
}
