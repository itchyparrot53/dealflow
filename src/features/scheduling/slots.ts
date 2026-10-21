import { z } from "zod";
import { BOOKING_DEFAULT_DURATION, SLOT_RANGE_MAX_DAYS } from "@/constants/formsBooking";
import { addDays, type Weekday, weekdayOf, zonedToUtc } from "./zonedTime";

// The slot engine is pure: it receives the page settings, the host's busy intervals and "now",
// and returns UTC ISO starts. The database layer only supplies busy time (busy.ts).

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

const availabilityRangeSchema = z
  .object({ from: hhmm, to: hhmm })
  .refine((r) => r.from < r.to, "the end time must be after the start time");

export type AvailabilityRange = z.infer<typeof availabilityRangeSchema>;
export type Availability = Record<Weekday, AvailabilityRange[]>;

function overlapsAny(ranges: AvailabilityRange[]): boolean {
  const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous !== undefined && current !== undefined && current.from < previous.to) return true;
  }
  return false;
}

const dayAvailabilitySchema = z
  .array(availabilityRangeSchema)
  .max(3, "at most three ranges a day")
  .refine((ranges) => !overlapsAny(ranges), "ranges must not overlap");

export const availabilitySchema = z.object({
  mon: dayAvailabilitySchema,
  tue: dayAvailabilitySchema,
  wed: dayAvailabilitySchema,
  thu: dayAvailabilitySchema,
  fri: dayAvailabilitySchema,
  sat: dayAvailabilitySchema,
  sun: dayAvailabilitySchema,
});

export const DEFAULT_AVAILABILITY: Availability = {
  mon: [{ from: "09:00", to: "17:00" }],
  tue: [{ from: "09:00", to: "17:00" }],
  wed: [{ from: "09:00", to: "17:00" }],
  thu: [{ from: "09:00", to: "17:00" }],
  fri: [{ from: "09:00", to: "17:00" }],
  sat: [],
  sun: [],
};

export interface SlotPage {
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  daysAhead: number;
  timezone: string;
  availability: Availability;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

const MINUTE_MS = 60_000;

function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clock(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

function overlaps(
  start: number,
  end: number,
  busy: readonly { start: number; end: number }[],
): boolean {
  return busy.some((interval) => start < interval.end && interval.start < end);
}

interface SlotWindow {
  duration: number;
  buffer: number;
  earliestStart: number;
  latestStart: number;
  busy: readonly { start: number; end: number }[];
}

// Every start one date offers inside its availability ranges, before the day loop deduplicates.
function startsOnDate(page: SlotPage, date: string, window: SlotWindow): number[] {
  const starts: number[] = [];
  for (const range of page.availability[weekdayOf(date)]) {
    const rangeStart = minutesOfDay(range.from);
    const rangeEnd = minutesOfDay(range.to);
    for (let minute = rangeStart; minute + window.duration <= rangeEnd; minute += window.duration) {
      const start = zonedToUtc(date, clock(minute), page.timezone).getTime();
      const end = start + window.duration * MINUTE_MS;
      if (start < window.earliestStart || start > window.latestStart) continue;
      const paddedStart = start - window.buffer * MINUTE_MS;
      const paddedEnd = end + window.buffer * MINUTE_MS;
      if (!overlaps(paddedStart, paddedEnd, window.busy)) starts.push(start);
    }
  }
  return starts;
}

/**
 * Free starts between `from` and `to` (inclusive calendar dates, in the page time zone).
 *
 * A window wider than SLOT_RANGE_MAX_DAYS is clamped to the first 14 days rather than refused:
 * the public route already rejects a wider window, and clamping keeps a direct caller bounded.
 */
export function computeSlots(
  page: SlotPage,
  busy: readonly BusyInterval[],
  now: Date,
  from: string,
  to: string,
): string[] {
  if (from > to) return [];
  const cap = addDays(from, SLOT_RANGE_MAX_DAYS - 1);
  const lastDate = to < cap ? to : cap;

  const window: SlotWindow = {
    duration: page.durationMinutes > 0 ? page.durationMinutes : BOOKING_DEFAULT_DURATION,
    buffer: page.bufferMinutes,
    earliestStart: now.getTime() + page.minNoticeHours * 60 * MINUTE_MS,
    latestStart: now.getTime() + page.daysAhead * 86_400_000,
    busy: busy.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() })),
  };

  const starts = new Set<number>();
  let date = from;
  for (let day = 0; day < SLOT_RANGE_MAX_DAYS && date <= lastDate; day += 1) {
    for (const start of startsOnDate(page, date, window)) starts.add(start);
    date = addDays(date, 1);
  }

  return [...starts].sort((a, b) => a - b).map((ms) => new Date(ms).toISOString());
}
