import { env } from "@/config/env";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Unauthenticated POSTs (login, magic link, invite accept) have no CSRF cookie yet, so they rely on
// Origin / Sec-Fetch-Site. Same rule as csrf.ts: BASE_URL origin, or a same-host loopback origin
// outside production (a dev server often runs on a different port than BASE_URL).
export function isSameOriginPost(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = headers.get("origin");
  if (origin === null) return site === "same-origin";
  if (origin === new URL(env.BASE_URL).origin) return true;
  if (env.NODE_ENV === "production") return false;
  try {
    const u = new URL(origin);
    return LOOPBACK.has(u.hostname) && u.host === headers.get("host");
  } catch {
    return false;
  }
}
