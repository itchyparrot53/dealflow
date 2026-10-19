import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { type AuthTokenKind, authTokens, users } from "@/db/schema";
import { err, ok, type Result } from "@/types/result";

// Auth tokens are bearer credentials delivered by email. Only their sha256 digest is stored, so a
// database read leak yields no usable link. The token itself is 256 bits of CSPRNG output, which is
// why plain sha256 (no salt, no work factor) is the right construction here.

const hashToken = (token: string): string => createHash("sha256").update(token).digest("base64url");

export const AUTH_TOKEN_TTL_MS: Record<AuthTokenKind, number> = {
  magic_link: 15 * 60_000,
  invite: 7 * 24 * 3_600_000,
  admin_setup: 24 * 3_600_000,
};

export interface MintedToken {
  token: string;
  expiresAt: Date;
}

export async function mintAuthToken(
  db: Db,
  userId: string,
  kind: AuthTokenKind,
  signal: AbortSignal,
): Promise<MintedToken> {
  signal.throwIfAborted();
  // One live invite link per user: issuing a new one retires the previous link so a forwarded
  // older email cannot still set a password.
  if (kind === "invite") {
    await db
      .update(authTokens)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.kind, kind),
          isNull(authTokens.consumedAt),
        ),
      );
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS[kind]);
  await db.insert(authTokens).values({ userId, kind, tokenHash: hashToken(token), expiresAt });
  signal.throwIfAborted();
  return { token, expiresAt };
}

const LIVE_TOKEN = (token: string, kinds: readonly AuthTokenKind[]) =>
  and(
    eq(authTokens.tokenHash, hashToken(token)),
    inArray(authTokens.kind, [...kinds]),
    isNull(authTokens.consumedAt),
    gt(authTokens.expiresAt, sql`now()`),
  );

// Read a token without consuming it, so a GET can render the confirm card and only the POST spends
// it. Joins users so a deactivated account cannot open a link.
export async function peekAuthToken(
  db: Db,
  token: string,
  kinds: readonly AuthTokenKind[],
  signal: AbortSignal,
): Promise<Result<{ userId: string; email: string; name: string; kind: AuthTokenKind }, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select({
      userId: authTokens.userId,
      kind: authTokens.kind,
      email: users.email,
      name: users.name,
      isActive: users.isActive,
    })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(LIVE_TOKEN(token, kinds))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined || !row.isActive) {
    return err(new AppError(ERROR_IDS.AUTH_TOKEN_INVALID, "invalid or expired token"));
  }
  return ok({ userId: row.userId, email: row.email, name: row.name, kind: row.kind });
}

export async function consumeAuthToken(
  db: Db,
  token: string,
  kinds: readonly AuthTokenKind[],
  signal: AbortSignal,
): Promise<Result<{ userId: string; kind: AuthTokenKind }, AppError>> {
  signal.throwIfAborted();
  // ONE statement: two concurrent clicks on the same link cannot both succeed.
  const rows = await db
    .update(authTokens)
    .set({ consumedAt: sql`now()` })
    .where(LIVE_TOKEN(token, kinds))
    .returning({ userId: authTokens.userId, kind: authTokens.kind });
  signal.throwIfAborted();
  const row = rows[0];
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.AUTH_TOKEN_INVALID, "invalid or expired token"));
  }
  const [user] = await db
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (user === undefined || !user.isActive) {
    return err(new AppError(ERROR_IDS.AUTH_TOKEN_INVALID, "inactive account"));
  }
  return ok({ userId: row.userId, kind: row.kind });
}
