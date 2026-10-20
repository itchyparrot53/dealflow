import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { createRateLimiter, type RateLimiter } from "@/server/rateLimit";
import { err, ok, type Result } from "@/types/result";

// Fixed-window limiter for the public document surface: 30 requests a minute per
// client IP and per document. In-memory and per-process by design (a single-box
// deploy), matching the rest of the unauthenticated edge.

const LIMIT = 30;
const WINDOW_MS = 60_000;

function newLimiter(): RateLimiter {
  return createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });
}

let limiter = newLimiter();

export function checkPublicRateLimit(
  ip: string,
  publicId: string,
  now: number = Date.now(),
): Result<void, AppError> {
  const byIp = limiter.check(`ip:${ip}`, now);
  const byDocument = limiter.check(`doc:${publicId}`, now);
  if (!byIp.allowed || !byDocument.allowed) {
    return err(
      new AppError(ERROR_IDS.DOC_RATE_LIMITED, "Too many public requests", {
        retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byDocument.retryAfterSeconds),
      }),
    );
  }
  return ok(undefined);
}

// Tests drive the window with explicit timestamps, so each case starts clean.
export function resetPublicRateLimitForTest(): void {
  limiter = newLimiter();
}
