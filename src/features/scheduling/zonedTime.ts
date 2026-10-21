import { AppError, ERROR_IDS } from "@/constants/errorIds";

// Time-zone arithmetic for booking pages, built on Intl only (no new dependency). Every function
// is pure and takes the zone as an argument, so the slot engine never reads the host's zone.

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Intl reports Sunday first; the booking week starts on Monday, so the label list is rotated
// instead of remapped by hand.
const WEEKDAY_BY_INDEX: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function partsInZone(at: Date, tz: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    // Some engines render midnight as "24" even under h23; normalise it.
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/** The zone's UTC offset, in minutes east of UTC, at the given instant. */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const p = partsInZone(at, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / MINUTE_MS);
}

function splitDate(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null)
    throw new AppError(ERROR_IDS.BOOKING_INVALID, "invalid booking date", { date });
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function splitTime(time: string): [number, number] {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (match === null)
    throw new AppError(ERROR_IDS.BOOKING_INVALID, "invalid booking time", { time });
  return [Number(match[1]), Number(match[2])];
}

/**
 * The UTC instant for a wall clock in a zone.
 *
 * A wall clock that does not exist (spring forward) resolves forward by the gap; one that happens
 * twice (fall back) takes the first occurrence. The plan's two-candidate sketch cannot tell those
 * apart, so both candidate offsets are tried and only the instants that really render back to the
 * requested wall clock count; when none does, the later candidate is the forward resolution.
 */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [year, month, day] = splitDate(date);
  const [hour, minute] = splitTime(time);
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  const before = tzOffsetMinutes(new Date(guess - DAY_MS), tz);
  const after = tzOffsetMinutes(new Date(guess + DAY_MS), tz);
  const candidates = [...new Set([guess - before * MINUTE_MS, guess - after * MINUTE_MS])].sort(
    (a, b) => a - b,
  );

  const wanted = `${date} ${pad2(hour)}:${pad2(minute)}`;
  for (const candidate of candidates) {
    const zoned = utcToZoned(new Date(candidate), tz);
    if (`${zoned.date} ${zoned.time}` === wanted) return new Date(candidate);
  }

  // Spring-forward gap: no instant carries this wall clock. The larger candidate is the one the
  // clocks jumped to, so the requested time resolves forward by the length of the gap.
  const forward = candidates[candidates.length - 1];
  if (forward === undefined) {
    throw new AppError(ERROR_IDS.BOOKING_INVALID, "could not resolve zoned time", {
      date,
      time,
      tz,
    });
  }
  return new Date(forward);
}

/** The wall clock and weekday of an instant in a zone. */
export function utcToZoned(at: Date, tz: string): { date: string; time: string; weekday: Weekday } {
  const p = partsInZone(at, tz);
  const index = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return {
    date: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
    weekday: WEEKDAY_BY_INDEX[index] ?? "mon",
  };
}

/** Calendar arithmetic on YYYY-MM-DD, done in UTC so a DST change cannot skip or repeat a day. */
export function addDays(date: string, n: number): string {
  const [year, month, day] = splitDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day) + n * DAY_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function isValidTimeZone(tz: string): boolean {
  if (tz === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar weekday of a YYYY-MM-DD date, independent of any zone. */
export function weekdayOf(date: string): Weekday {
  const [year, month, day] = splitDate(date);
  return WEEKDAY_BY_INDEX[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "mon";
}
