import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { ERROR_IDS } from "@/constants/errorIds";
import { BOOKING_BOOK_PER_MINUTE } from "@/constants/formsBooking";
import { BOOKING_COPY } from "@/constants/formsBookingStrings";
import { db } from "@/db/client";
import { clientIp } from "@/features/net/clientIp";
import { cancelBooking } from "@/features/scheduling/cancel";
import { createRateLimiter, type RateLimiter } from "@/server/rateLimit";

// Cancel by link. The token is the credential; the route accepts it as JSON or as a classic form
// field and never trusts anything else.

const RATE_WINDOW_MS = 60_000;

function newLimiter(): RateLimiter {
  return createRateLimiter({ limit: BOOKING_BOOK_PER_MINUTE, windowMs: RATE_WINDOW_MS });
}

let limiter = newLimiter();

export function resetCancelRateLimitForTest(): void {
  limiter = newLimiter();
}

function isFormEncoded(req: NextRequest): boolean {
  return (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
}

function tokenOf(raw: string, formEncoded: boolean): string {
  if (formEncoded) return new URLSearchParams(raw).get("token") ?? "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const token = (parsed as { token?: unknown }).token;
      return typeof token === "string" ? token : "";
    }
  } catch {
    return "";
  }
  return "";
}

export async function POST(req: NextRequest): Promise<Response> {
  const formEncoded = isFormEncoded(req);
  const ip = clientIp(req.headers);
  const limited = limiter.check(`ip:${ip}`, Date.now());
  if (!limited.allowed) {
    return NextResponse.json(
      { error: ERROR_IDS.BOOKING_RATE_LIMITED, message: BOOKING_COPY.rateLimited },
      { status: 429 },
    );
  }

  const token = tokenOf(await req.text(), formEncoded);
  const result = await cancelBooking(db, token, new Date(), AbortSignal.timeout(15_000));
  if (!result.ok) {
    // An unknown or already-used link is a 404: there is no booking to show or cancel.
    return NextResponse.json(
      { error: result.error.id, message: BOOKING_COPY.cancelInvalid },
      { status: 404 },
    );
  }
  if (formEncoded) {
    return NextResponse.redirect(`${env.BASE_URL}/book/cancel/${token}?cancelled=1`, {
      status: 303,
    });
  }
  return NextResponse.json({ ok: true });
}
