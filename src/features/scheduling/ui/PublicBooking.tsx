"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { BOOKING_COPY, BOOKING_STRINGS } from "@/constants/formsBookingStrings";
import { PoweredBy } from "@/features/public/PoweredBy";
import { BookingConfirmed } from "./BookingConfirmed";

const S = BOOKING_STRINGS;

interface SlotResponse {
  timezone?: string;
  durationMinutes?: number;
  slots?: string[];
}

interface BookResponse {
  ok?: boolean;
  start?: string;
  end?: string;
  hostName?: string;
  timezone?: string;
  ics?: string;
  message?: string | null;
}

function dateInZone(at: Date, timezone: string): string {
  // en-CA renders YYYY-MM-DD, which is exactly the slot API's date form.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function labelForDate(date: string, timezone: string): string {
  const at = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(at);
}

function labelForSlot(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

interface SlotFetchResult {
  slots: string[];
  error: string | null;
}

async function fetchSlots(
  publicId: string,
  day: string,
  attempt: number,
  signal: AbortSignal,
): Promise<SlotFetchResult> {
  try {
    // `attempt` is not read by the server; it makes a post-409 refetch a distinct request for the
    // effect's dependency list and any intermediary cache.
    const response = await fetch(
      `/api/public/booking/${publicId}/slots?from=${day}&to=${day}&attempt=${attempt}`,
      { signal },
    );
    if (response.status === 429) return { slots: [], error: BOOKING_COPY.rateLimited };
    if (!response.ok) return { slots: [], error: BOOKING_COPY.unavailable };
    const body = (await response.json()) as SlotResponse;
    return { slots: body.slots ?? [], error: null };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { slots: [], error: null };
    }
    return { slots: [], error: BOOKING_COPY.unavailable };
  }
}

function SlotGrid({
  slots,
  loading,
  error,
  timezone,
  onPick,
}: {
  slots: string[];
  loading: boolean;
  error: string | null;
  timezone: string;
  onPick: (slot: string) => void;
}): React.ReactNode {
  if (loading) {
    return <p className="col-span-3 text-sm text-muted-foreground">Loading times...</p>;
  }
  if (error !== null) {
    return <p className="col-span-3 text-sm text-destructive">{error}</p>;
  }
  if (slots.length === 0) {
    return <p className="col-span-3 text-sm text-muted-foreground">No times left on this day.</p>;
  }
  return (
    <>
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          data-testid="booking-slot"
          data-start={slot}
          onClick={() => onPick(slot)}
          className="rounded-md border border-border px-3 py-2 text-center text-sm"
        >
          {labelForSlot(slot, timezone)}
        </button>
      ))}
    </>
  );
}

interface BookingFormProps {
  chosenStart: string;
  displayTimezone: string;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  website: string;
  setWebsite: (value: string) => void;
  submitError: string | null;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

function BookingForm(props: BookingFormProps): React.ReactNode {
  const when = `${labelForDate(dateInZone(new Date(props.chosenStart), props.displayTimezone), props.displayTimezone)} at ${labelForSlot(props.chosenStart, props.displayTimezone)}`;
  return (
    <div className="mt-8 space-y-3">
      <p className="text-sm font-medium">{when}</p>
      <label htmlFor="booking-name" className="block text-sm">
        Name
        <Input
          id="booking-name"
          data-testid="booking-name"
          value={props.name}
          maxLength={100}
          onChange={(event) => props.setName(event.target.value)}
          className="mt-1"
        />
      </label>
      <label htmlFor="booking-email" className="block text-sm">
        Email
        <Input
          id="booking-email"
          type="email"
          data-testid="booking-email"
          value={props.email}
          maxLength={320}
          onChange={(event) => props.setEmail(event.target.value)}
          className="mt-1"
        />
      </label>
      <label htmlFor="booking-note" className="block text-sm">
        Note (optional)
        <Textarea
          id="booking-note"
          data-testid="booking-note"
          rows={3}
          maxLength={1000}
          value={props.note}
          onChange={(event) => props.setNote(event.target.value)}
          className="mt-1"
        />
      </label>
      <div aria-hidden="true" className="hidden">
        <label htmlFor="booking-website">
          Website
          <input
            id="booking-website"
            tabIndex={-1}
            autoComplete="off"
            value={props.website}
            onChange={(event) => props.setWebsite(event.target.value)}
          />
        </label>
      </div>
      {props.submitError === null ? null : (
        <p className="text-sm text-destructive" role="alert">
          {props.submitError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-testid="booking-submit"
          disabled={props.submitting || props.name.trim() === "" || props.email.trim() === ""}
          onClick={props.onSubmit}
        >
          Confirm booking
        </Button>
        <Button type="button" variant="ghost" onClick={props.onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export function PublicBooking({
  publicId,
  title,
  description,
  hostName,
  durationMinutes,
  location,
  pageTimezone,
}: {
  publicId: string;
  title: string;
  description: string | null;
  hostName: string;
  durationMinutes: number;
  location: string | null;
  pageTimezone: string;
}): React.ReactNode {
  const [displayTimezone, setDisplayTimezone] = useState(pageTimezone);
  // Today in the visitor's zone. Set from a timer rather than synchronously in the effect: the
  // React rule against setState in an effect body is right, this is external-clock synchronisation.
  const [today, setToday] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<BookResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // The visitor's own zone drives the labels; until the browser reports it, the page zone is used.
  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timer = setTimeout(() => {
      const zone = typeof resolved === "string" && resolved !== "" ? resolved : pageTimezone;
      setDisplayTimezone(zone);
      setToday(dateInZone(new Date(), zone));
    }, 0);
    return () => clearTimeout(timer);
  }, [pageTimezone]);

  const days = useMemo(() => {
    if (today === null) return [];
    const base = new Date(`${today}T12:00:00.000Z`).getTime();
    return Array.from({ length: 14 }, (_, index) =>
      dateInZone(new Date(base + index * 86_400_000), displayTimezone),
    );
  }, [today, displayTimezone]);

  const activeDay =
    selectedDay !== null && days.includes(selectedDay) ? selectedDay : (days[0] ?? null);

  useEffect(() => {
    if (activeDay === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setSlotError(null);
      void fetchSlots(publicId, activeDay, refreshKey, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        setSlots(result.slots);
        setSlotError(result.error);
        setLoading(false);
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [publicId, activeDay, refreshKey]);

  const dayOptions = useMemo(
    () => days.map((day) => ({ day, label: labelForDate(day, displayTimezone) })),
    [days, displayTimezone],
  );

  async function book(): Promise<void> {
    if (chosenStart === null) return;
    setSubmitting(true);
    setSubmitError(null);
    let response: Response;
    try {
      response = await fetch(`/api/public/booking/${publicId}/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: chosenStart, name, email, note, website }),
      });
    } catch {
      setSubmitting(false);
      setSubmitError("Could not reach the server. Please try again.");
      return;
    }
    setSubmitting(false);
    const body = (await response.json().catch(() => ({}))) as BookResponse;
    if (response.status === 409) {
      setSubmitError(BOOKING_COPY.slotTaken);
      setChosenStart(null);
      setRefreshKey((key) => key + 1);
      return;
    }
    if (response.status === 429) {
      setSubmitError(BOOKING_COPY.rateLimited);
      return;
    }
    if (response.status !== 200 || body.ok !== true) {
      setSubmitError(body.message ?? BOOKING_COPY.unavailable);
      return;
    }
    setConfirmed(body);
  }

  if (
    confirmed !== null &&
    typeof confirmed.start === "string" &&
    typeof confirmed.end === "string"
  ) {
    return (
      <main className="mx-auto w-full max-w-[640px] bg-background px-6 py-10 text-foreground">
        <BookingConfirmed
          start={confirmed.start}
          end={confirmed.end}
          hostName={confirmed.hostName ?? hostName}
          ics={confirmed.ics ?? ""}
          displayTimezone={displayTimezone}
        />
      </main>
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-[640px] bg-background px-6 py-10 text-foreground"
      data-testid="public-booking"
    >
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{hostName}</p>
        <h1 className="text-display font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {durationMinutes} {S.editor.minutes}
          {location === null ? "" : ` · ${location}`}
        </p>
        {description === null || description.trim() === "" ? null : (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <p className="text-xs text-muted-foreground">Times shown in {displayTimezone}</p>
      </header>

      {chosenStart === null ? (
        <>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pick a day">
            {dayOptions.map(({ day, label }) => (
              <button
                key={day}
                type="button"
                data-testid="booking-day"
                data-date={day}
                onClick={() => setSelectedDay(day)}
                className={
                  day === activeDay
                    ? "rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                    : "rounded-md border border-border px-3 py-1 text-sm"
                }
              >
                {label}
              </button>
            ))}
          </nav>

          <section className="mt-6 grid grid-cols-3 gap-2" aria-label="Pick a time">
            <SlotGrid
              slots={slots}
              loading={loading}
              error={slotError}
              timezone={displayTimezone}
              onPick={setChosenStart}
            />
          </section>
        </>
      ) : (
        <BookingForm
          chosenStart={chosenStart}
          displayTimezone={displayTimezone}
          name={name}
          setName={setName}
          email={email}
          setEmail={setEmail}
          note={note}
          setNote={setNote}
          website={website}
          setWebsite={setWebsite}
          submitError={submitError}
          submitting={submitting}
          onSubmit={() => void book()}
          onBack={() => setChosenStart(null)}
        />
      )}
      <PoweredBy />
    </main>
  );
}
