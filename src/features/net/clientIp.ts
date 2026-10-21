import { env } from "@/config/env";

// The client address for rate limits has to come from the proxy chain, not from the caller:
// every entry left of the trusted boundary is attacker-written. The app is normally reachable
// only through a reverse proxy that APPENDS the peer address, so counting from the right is the
// only reading the proxy actually vouches for. Expose the app port directly and the header is
// entirely caller-written, at which point these limits enforce nothing (see rateLimit.ts).
const UNKNOWN = "unknown";

function firstHeaderValue(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)?.trim();
  return value !== undefined && value !== "" ? value : undefined;
}

function forwardedEntries(headers: Headers): string[] {
  return (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function clientIp(headers: Headers, hops: number = env.TRUSTED_PROXY_HOPS): string {
  if (hops <= 0) {
    return firstHeaderValue(headers, "x-real-ip") ?? UNKNOWN;
  }
  const entries = forwardedEntries(headers);
  if (entries.length === 0) {
    return firstHeaderValue(headers, "x-real-ip") ?? UNKNOWN;
  }
  // Entry `hops` places from the right is the address the outermost trusted proxy saw. When the
  // chain is shorter than the hop count, the leftmost entry is the best available answer.
  const index = Math.max(0, entries.length - hops);
  return entries[index] ?? UNKNOWN;
}
