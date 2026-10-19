import { eq } from "drizzle-orm";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { ok, type Result } from "@/types/result";
import { consumeAuthToken, mintAuthToken } from "./authTokens";
import { markEmailVerified, setPassword } from "./credentials";
import { checkPasswordPolicy } from "./password";

export async function issueInviteLink(
  db: Db,
  userId: string,
  baseUrl: string,
  signal: AbortSignal,
): Promise<{ url: string; expiresAt: Date }> {
  const { token, expiresAt } = await mintAuthToken(db, userId, "invite", signal);
  return { url: `${baseUrl}/login/invite?token=${encodeURIComponent(token)}`, expiresAt };
}

export async function acceptInvite(
  db: Db,
  input: { token: string; name: string; password: string },
  signal: AbortSignal,
): Promise<Result<{ userId: string }, AppError>> {
  const policy = checkPasswordPolicy(input.password);
  if (!policy.ok) return policy;

  const consumed = await consumeAuthToken(db, input.token, ["invite", "admin_setup"], signal);
  if (!consumed.ok) return consumed;

  await db
    .update(users)
    .set({ name: input.name.trim(), invitedAt: null })
    .where(eq(users.id, consumed.value.userId));
  await setPassword(db, consumed.value.userId, input.password, signal);
  await markEmailVerified(db, consumed.value.userId, signal);
  signal.throwIfAborted();
  return ok({ userId: consumed.value.userId });
}
