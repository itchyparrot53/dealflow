import type { Metadata } from "next";
import { db } from "@/db/client";
import { PoweredBy } from "@/features/public/PoweredBy";
import { loadBookingByToken } from "@/features/scheduling/cancel";

// The cancel page behind the emailed link. It shows the booking and one button; the visitor's
// only credential is the token in the URL.

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cancel booking" };

function formatWhen(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

export default async function CancelBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}): Promise<React.ReactNode> {
  const { token } = await params;
  const { cancelled } = await searchParams;
  const info = await loadBookingByToken(db, token, AbortSignal.timeout(5000));

  if (info === null) {
    return (
      <main className="mx-auto w-full max-w-[560px] bg-background px-6 py-12 text-foreground">
        <h1 className="text-display font-semibold">Booking not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This booking was already cancelled or the link is invalid.
        </p>
        <PoweredBy />
      </main>
    );
  }

  const done = cancelled === "1" || info.status === "cancelled";
  return (
    <main className="mx-auto w-full max-w-[560px] bg-background px-6 py-12 text-foreground">
      <h1 className="text-display font-semibold">{info.pageTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatWhen(info.startAt, info.timezone)} ({info.timezone})
      </p>
      <p className="text-sm text-muted-foreground">with {info.hostName}</p>

      {done ? (
        <p className="mt-6 rounded-md bg-muted px-4 py-3 text-sm" data-testid="booking-cancelled">
          This booking is cancelled.
        </p>
      ) : (
        <form method="post" action="/api/public/booking/cancel" className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            data-testid="booking-cancel-confirm"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Cancel booking
          </button>
        </form>
      )}
      <PoweredBy />
    </main>
  );
}
