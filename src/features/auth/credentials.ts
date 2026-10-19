import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { type UserCredentials, userCredentials } from "@/db/schema";
import { hashPassword } from "./password";

// Credentials live in their own table (see src/db/schema/authLocal.ts). These helpers never import
// the env module so the e2e seed script can reuse them.

export async function getCredentials(
  db: Db,
  userId: string,
  signal: AbortSignal,
): Promise<UserCredentials | undefined> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId))
    .limit(1);
  signal.throwIfAborted();
  return row;
}

export async function setPassword(
  db: Db,
  userId: string,
  password: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const passwordHash = await hashPassword(password);
  signal.throwIfAborted();
  const now = new Date();
  await db
    .insert(userCredentials)
    .values({ userId, passwordHash, passwordUpdatedAt: now })
    .onConflictDoUpdate({
      target: userCredentials.userId,
      set: {
        passwordHash,
        passwordUpdatedAt: now,
        // A deliberate password change clears the lockout counters.
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  signal.throwIfAborted();
}

export async function markEmailVerified(
  db: Db,
  userId: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const emailVerifiedAt = new Date();
  await db
    .insert(userCredentials)
    .values({ userId, emailVerifiedAt })
    .onConflictDoUpdate({ target: userCredentials.userId, set: { emailVerifiedAt } });
  signal.throwIfAborted();
}
