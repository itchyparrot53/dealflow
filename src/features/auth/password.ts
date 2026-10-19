import { hash, verify } from "@node-rs/argon2";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok, type Result } from "@/types/result";

// Password policy and hashing. Deliberately does not import the env module: the e2e seed script and
// the bootstrap CLI construct these services without a full app config.
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export function hashPassword(password: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id with its recommended parameters.
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed or unknown hash is a failed check, not a crash on the sign-in path.
    return false;
  }
}

export function checkPasswordPolicy(password: string): Result<string, AppError> {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return err(
      new AppError(
        ERROR_IDS.AUTH_PASSWORD_WEAK,
        `password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
      ),
    );
  }
  return ok(password);
}
