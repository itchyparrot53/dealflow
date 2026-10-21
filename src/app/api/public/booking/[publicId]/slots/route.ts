import { type NextRequest, NextResponse } from "next/server";
import { ERROR_IDS } from "@/constants/errorIds";
import { BOOKING_SLOTS_PER_MINUTE } from "@/constants/formsBooking";
import { db } from "@/db/client";
import { clientIp } from "@/features/net/clientIp";
import { getSlots } from "@/features/scheduling/booking";
import { createRateLimiter, type RateLimiter } from "@/server/rateLimit";

// Public availability read. No session and no origin check: the booking page is embedded
// elsewhere. The rate limit is per client IP and per page.

const RATE_WINDOW_MS = 60_000;

function newLimiter(): RateLimiter {
  return createRateLimiter({ limit: BOOKING_SLOTS_PER_MINUTE, windowMs: RATE_WINDOW_MS });
}

let limiter = newLimiter();

export function resetSlotsRateLimitForTest(): void {
  limiter = newLimiter();
}

function statusFor(errorId: string): number {
  if (errorId === ERROR_IDS.BOOKING_NOT_FOUND) return 404;
  if (errorId === ERROR_IDS.BOOKING_RATE_LIMITED) return 429;
  return 400;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> },
): Promise<Response> {
  const { publicId } = await ctx.params;
  const ip = clientIp(req.headers);
  const now = Date.now();
  const byIp = limiter.check(`ip:${ip}`, now);
  if (!byIp.allowed) {
    const response = NextResponse.json({ error: ERROR_IDS.BOOKING_RATE_LIMITED }, { status: 429 });
    response.headers.set("Retry-After", String(byIp.retryAfterSeconds));
    return response;
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const result = await getSlots(db, publicId, from, to, new Date(now), AbortSignal.timeout(10_000));
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.id, issues: result.error.context?.issues ?? [] },
      { status: statusFor(result.error.id) },
    );
  }
  return NextResponse.json(result.value);
}
