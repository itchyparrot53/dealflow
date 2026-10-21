import { createHash, randomBytes } from "node:crypto";

// A cancel link is a bearer credential, so only its SHA-256 hex is stored. Plain SHA-256 is right
// here for the same reason as session tokens: the input is 24 random bytes, not a human choice.
export function newCancelToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
