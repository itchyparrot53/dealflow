"use client";

import { PoweredBy } from "@/features/public/PoweredBy";

function whenLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function BookingConfirmed({
  start,
  end,
  hostName,
  ics,
  displayTimezone,
}: {
  start: string;
  end: string;
  hostName: string;
  ics: string;
  displayTimezone: string;
}): React.ReactNode {
  const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  return (
    <section className="space-y-4" data-testid="booking-confirmed">
      <h1 className="text-title">You&apos;re booked</h1>
      <p className="text-sm">
        You&apos;re booked for {whenLabel(start, displayTimezone)} ({displayTimezone}) with{" "}
        {hostName}.
      </p>
      <p className="text-sm text-muted-foreground">
        Ends at {whenLabel(end, displayTimezone)}. A confirmation email is on its way.
      </p>
      <a
        href={dataUrl}
        download="invite.ics"
        className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium"
      >
        Add to calendar
      </a>
      <PoweredBy />
    </section>
  );
}
