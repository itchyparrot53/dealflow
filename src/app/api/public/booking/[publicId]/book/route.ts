import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { ERROR_IDS } from "@/constants/errorIds";
import { BOOKING_BOOK_PER_MINUTE } from "@/constants/formsBooking";
import { BOOKING_COPY } from "@/constants/formsBookingStrings";
import { db } from "@/db/client";
import { clientIp } from "@/features/net/clientIp";
import { bookSlot } from "@/features/scheduling/booking";
import { createRateLimiter, type RateLimiter } from "@/server/rateLimit";

// Public booking write. The body is JSON from the enhanced page or a classic form post; both go
// through the same validated service and are serialised per host by its advisory lock.

const RATE_WINDOW_MS = 60_000;

function newLimiter(): RateLimiter {
  return createRateLimiter({ limit: BOOKING_BOOK_PER_MINUTE, windowMs: RATE_WINDOW_MS });
}

let limiter = newLimiter();

export function resetBookRateLimitForTest(): void {
  limiter = newLimiter();
}

function isFormEncoded(req: NextRequest): boolean {
  return (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
}

function parseBody(raw: string, formEncoded: boolean): Record<string, unknown> | null {
  if (formEncoded) {
    const params = new URLSearchParams(raw);
    const note = params.get("note");
    return {
      start: params.get("start") ?? "",
      name: params.get("name") ?? "",
      email: params.get("email") ?? "",
      note: note === null || note === "" ? null : note,
      website: params.get("website") ?? undefined,
    };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function statusFor(errorId: string): number {
  if (errorId === ERROR_IDS.BOOKING_NOT_FOUND) return 404;
  if (errorId === ERROR_IDS.BOOKING_SLOT_TAKEN) return 409;
  if (errorId === ERROR_IDS.BOOKING_RATE_LIMITED) return 429;
  return 400;
}

function messageFor(errorId: string): string | null {
  if (errorId === ERROR_IDS.BOOKING_SLOT_TAKEN) return BOOKING_COPY.slotTaken;
  if (errorId === ERROR_IDS.BOOKING_NOT_FOUND) return BOOKING_COPY.unavailable;
  if (errorId === ERROR_IDS.BOOKING_RATE_LIMITED) return BOOKING_COPY.rateLimited;
  return null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> },
): Promise<Response> {
  const { publicId } = await ctx.params;
  const formEncoded = isFormEncoded(req);

  const ip = clientIp(req.headers);
  const now = Date.now();
  const limited = limiter.check(`ip:${ip}:${publicId}`, now);
  if (!limited.allowed) {
    const response = NextResponse.json(
      { error: ERROR_IDS.BOOKING_RATE_LIMITED, message: BOOKING_COPY.rateLimited },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(limited.retryAfterSeconds));
    return response;
  }

  const raw = await req.text();
  const body = parseBody(raw, formEncoded);
  if (body === null) {
    return NextResponse.json({ error: ERROR_IDS.BOOKING_INPUT_INVALID }, { status: 400 });
  }

  const result = await bookSlot(db, publicId, body, new Date(now), AbortSignal.timeout(15_000));
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error.id,
        message: messageFor(result.error.id),
        issues: result.error.context?.issues ?? [],
      },
      { status: statusFor(result.error.id) },
    );
  }

  if (formEncoded) {
    return NextResponse.redirect(`${env.BASE_URL}/book/${publicId}?booked=1`, { status: 303 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}
