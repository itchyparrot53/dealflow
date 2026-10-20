import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, ok, type Result } from "@/types/result";
import { getCredentials, setPassword } from "./credentials";
import { checkPasswordPolicy, verifyPassword } from "./password";
import { recentLinkSignIn } from "./sessionAuth";
import { revokeOtherSessions } from "./sessionsAdmin";

export interface ChangePasswordInput {
  actorId: string;
  sessionId: string;
  currentPassword?: string;
  newPassword: string;
}

// The password change itself, outside the "use server" action so integration tests can call it
// with a real database. A forgotten password is recovered by signing in with an emailed link: the
// link proved the mailbox seconds ago, so it stands in for the current password for 15 minutes.
export async function changePasswordForSession(
  db: Db,
  input: ChangePasswordInput,
  signal: AbortSignal,
): Promise<Result<{ ok: true }, AppError>> {
  const policy = checkPasswordPolicy(input.newPassword);
  if (!policy.ok) return err(policy.error);

  const credentials = await getCredentials(db, input.actorId, signal);
  if (credentials?.passwordHash != null) {
    const linkSignIn = await recentLinkSignIn(db, input.sessionId, signal);
    if (!linkSignIn) {
      const matches = await verifyPassword(credentials.passwordHash, input.currentPassword ?? "");
      if (!matches) {
        return err(new AppError(ERROR_IDS.AUTH_PASSWORD_MISMATCH, "current password mismatch"));
      }
    }
  }

  await setPassword(db, input.actorId, input.newPassword, signal);
  // A stolen session must not survive the password change; keep the one that made it.
  await revokeOtherSessions(db, input.actorId, input.sessionId, signal);
  return ok({ ok: true });
}
