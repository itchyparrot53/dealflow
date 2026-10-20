import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { userCredentials, users } from "@/db/schema";
import { err, ok, type Result } from "@/types/result";
import { getCredentials } from "./credentials";
import { hashPassword, verifyPassword } from "./password";

// Local sign-in limits. Numbers live here (not in the UI strings module) because they are policy.
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCK_MS = 15 * 60_000;

// Hashing a dummy password for unknown emails keeps the response time close to a real check, so the
// endpoint does not become an account-existence oracle through timing alone.
let dummyHash: Promise<string> | null = null;
const dummy = (): Promise<string> => (dummyHash ??= hashPassword("dealflow-timing-equaliser"));

export async function passwordLogin(
  db: Db,
  input: { email: string; password: string },
  signal: AbortSignal,
): Promise<Result<{ userId: string }, AppError>> {
  const email = input.email.trim().toLowerCase();
  const [u] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  signal.throwIfAborted();
  const cred = u === undefined ? undefined : await getCredentials(db, u.id, signal);
  if (u === undefined || !u.isActive || cred?.passwordHash == null) {
    await verifyPassword(await dummy(), input.password);
    return err(new AppError(ERROR_IDS.AUTH_INVALID_CREDENTIALS, "invalid credentials"));
  }
  if (cred.lockedUntil !== null && cred.lockedUntil > new Date()) {
    return err(
      new AppError(ERROR_IDS.AUTH_LOCKED, "locked", { until: cred.lockedUntil.toISOString() }),
    );
  }
  if (!(await verifyPassword(cred.passwordHash, input.password))) {
    // Increment in one statement: reading the counter and writing it back lets concurrent wrong
    // guesses all read the same value and undercount, which would dodge the lockout.
    const [counted] = await db
      .update(userCredentials)
      .set({ failedLoginCount: sql`${userCredentials.failedLoginCount} + 1` })
      .where(eq(userCredentials.userId, u.id))
      .returning({ failedLoginCount: userCredentials.failedLoginCount });
    if ((counted?.failedLoginCount ?? 0) >= LOGIN_MAX_FAILURES) {
      await db
        .update(userCredentials)
        .set({ failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCK_MS) })
        .where(eq(userCredentials.userId, u.id));
    }
    return err(new AppError(ERROR_IDS.AUTH_INVALID_CREDENTIALS, "invalid credentials"));
  }
  await db
    .update(userCredentials)
    .set({ failedLoginCount: 0, lockedUntil: null })
    .where(eq(userCredentials.userId, u.id));
  return ok({ userId: u.id });
}
