import { createRateLimiter, type RateLimiter } from "@/server/rateLimit";

// Per-user AI request limiter: 20 calls a minute. Pinned to globalThis because Next bundles server
// code into layers, and a module-level limiter would give each layer its own allowance.
const LIMITER_KEY = Symbol.for("dealflow.aiRateLimiter");
const AI_REQUESTS_PER_MINUTE = 20;

function limiter(): RateLimiter {
  const store: Record<symbol, RateLimiter | undefined> = globalThis;
  const existing = store[LIMITER_KEY];
  if (existing !== undefined) return existing;
  const created = createRateLimiter({ limit: AI_REQUESTS_PER_MINUTE, windowMs: 60_000 });
  store[LIMITER_KEY] = created;
  return created;
}

export function checkAiRateLimit(userId: string): boolean {
  return limiter().check(userId, Date.now()).allowed;
}
