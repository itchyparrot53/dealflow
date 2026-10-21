import { createHash, randomBytes } from "node:crypto";
import { API_TOKEN_PREFIX } from "@/constants/projectsApi";

// API tokens are shown once and stored as a SHA-256 digest. The digest is the lookup key, so a
// leaked database row cannot be turned back into a working token.

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newApiToken(): { token: string; hash: string; prefix: string } {
  // 32 random bytes in base64url: 43 characters, no padding, URL-safe.
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashApiToken(token), prefix: token.slice(0, 12) };
}

const BEARER = /^Bearer ([A-Za-z0-9_-]+)$/i;

// Exactly "Bearer <token>" with one space: the scheme is case-insensitive, the dfk_ prefix is not
// optional. Anything else (another scheme, a cookie-backed request, stray spaces) is no token.
export function parseBearer(header: string | null): string | null {
  if (header === null) return null;
  const match = BEARER.exec(header);
  if (match === null) return null;
  const token = match[1];
  if (token === undefined) return null;
  return token.startsWith(API_TOKEN_PREFIX) ? token : null;
}
