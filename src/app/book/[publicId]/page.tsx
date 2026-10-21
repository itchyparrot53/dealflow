import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { PoweredBy } from "@/features/public/PoweredBy";
import { getSlots, loadPublicBookingPage } from "@/features/scheduling/booking";
import { addDays, utcToZoned } from "@/features/scheduling/zonedTime";

// The public booking page. Minimal markup in this task; Task 3.4 replaces it with the date strip,
// visitor-zone display and the client confirmation.

export const dynamic = "force-dynamic";

function nowMs(): number {
  return Date.now();
}

function formatSlot(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const loaded = await loadPublicBookingPage(db, publicId, AbortSignal.timeout(5000));
  return { title: loaded?.page.title ?? "Booking page not available" };
}

export default async function PublicBookingPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ date?: string; start?: string; booked?: string }>;
}): Promise<React.ReactNode> {
  const { publicId } = await params;
  const query = await searchParams;
  const loaded = await loadPublicBookingPage(db, publicId, AbortSignal.timeout(5000));
  if (loaded === null) notFound();

  const now = new Date(nowMs());
  const firstDay = utcToZoned(now, loaded.timezone).date;
  const days = Array.from({ length: 14 }, (_, index) => addDays(firstDay, index));
  const selectedDay =
    query.date !== undefined && days.includes(query.date) ? query.date : (days[0] as string);
  const slotResult = await getSlots(
    db,
    publicId,
    selectedDay,
    selectedDay,
    now,
    AbortSignal.timeout(5000),
  );
  const slots = slotResult.ok ? slotResult.value.slots : [];
  const chosenStart = query.start !== undefined && slots.includes(query.start) ? query.start : null;

  return (
    <main className="mx-auto w-full max-w-[640px] bg-background px-6 py-10 text-foreground">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{loaded.host.name}</p>
        <h1 className="text-display font-semibold">{loaded.page.title}</h1>
        <p className="text-sm text-muted-foreground">
          {loaded.page.durationMinutes} minutes
          {loaded.page.location === null ? "" : ` · ${loaded.page.location}`}
        </p>
        {loaded.page.description === null ? null : (
          <p className="text-sm text-muted-foreground">{loaded.page.description}</p>
        )}
      </header>

      {query.booked === "1" ? (
        <p className="mt-6 rounded-md bg-muted px-4 py-3 text-sm" data-testid="booking-confirmed">
          Your booking is confirmed. A confirmation email is on its way.
        </p>
      ) : (
        <>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pick a day">
            {days.map((day) => (
              <Link
                key={day}
                href={`/book/${publicId}?date=${day}`}
                data-testid="booking-day"
                data-date={day}
                className={
                  day === selectedDay
                    ? "rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                    : "rounded-md border border-border px-3 py-1 text-sm"
                }
              >
                {formatSlot(`${day}T12:00:00.000Z`, "UTC").slice(0, 6)}
              </Link>
            ))}
          </nav>

          <section className="mt-6 grid grid-cols-3 gap-2" aria-label="Pick a time">
            {slots.length === 0 ? (
              <p className="col-span-3 text-sm text-muted-foreground">No times left on this day.</p>
            ) : (
              slots.map((slot) => (
                <Link
                  key={slot}
                  href={`/book/${publicId}?date=${selectedDay}&start=${encodeURIComponent(slot)}`}
                  data-testid="booking-slot"
                  data-start={slot}
                  className="rounded-md border border-border px-3 py-2 text-center text-sm"
                >
                  {formatSlot(slot, loaded.timezone)}
                </Link>
              ))
            )}
          </section>

          {chosenStart === null ? null : (
            <form
              method="post"
              action={`/api/public/booking/${publicId}/book`}
              className="mt-8 space-y-3"
              data-testid="booking-form"
            >
              <p className="text-sm font-medium">{formatSlot(chosenStart, loaded.timezone)}</p>
              <input type="hidden" name="start" value={chosenStart} />
              <label htmlFor="booking-name" className="block text-sm">
                Name
                <input
                  id="booking-name"
                  name="name"
                  required
                  maxLength={100}
                  data-testid="booking-name"
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
              <label htmlFor="booking-email" className="block text-sm">
                Email
                <input
                  id="booking-email"
                  name="email"
                  type="email"
                  required
                  maxLength={320}
                  data-testid="booking-email"
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
              <label htmlFor="booking-note" className="block text-sm">
                Note (optional)
                <textarea
                  id="booking-note"
                  name="note"
                  rows={3}
                  maxLength={1000}
                  data-testid="booking-note"
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </label>
              <div aria-hidden="true" className="hidden">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <button
                type="submit"
                data-testid="booking-submit"
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Confirm booking
              </button>
            </form>
          )}
        </>
      )}
      <PoweredBy />
    </main>
  );
}
