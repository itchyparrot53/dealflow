import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { utcToZoned, zonedToUtc } from "@/features/scheduling/zonedTime";
import type { DatePreset, Interval } from "./definition";

// Date-range resolution and time bucketing for Insights. Everything here is pure and takes the
// zone as an argument: the viewer's zone comes from user_preferences.timezone (else UTC), so a
// month bucket means the viewer's month, never the server's. Weeks are ISO weeks (Monday start);
// quarters are calendar quarters; date columns (expected_close_date) use local day boundaries.

export interface RangeSpec {
  field: string;
  preset: DatePreset;
  from?: string;
  to?: string;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DAY_MS = 86_400_000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function splitDate(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    throw new AppError(ERROR_IDS.INSIGHT_DEFINITION_INVALID, "invalid civil date", { date });
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function civil(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDaysCivil(date: string, days: number): string {
  const [y, m, d] = splitDate(date);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return civil(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
}

export function addMonthsCivil(date: string, months: number): string {
  const [y, m, d] = splitDate(date);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return civil(year, month, Math.min(d, daysInMonth(year, month)));
}

function startOfMonth(date: string): string {
  const [y, m] = splitDate(date);
  return civil(y, m, 1);
}

function startOfQuarter(date: string): string {
  const [y, m] = splitDate(date);
  return civil(y, Math.floor((m - 1) / 3) * 3 + 1, 1);
}

function startOfYear(date: string): string {
  const [y] = splitDate(date);
  return civil(y, 1, 1);
}

/** ISO weekday: 0 is Monday through 6 is Sunday. */
function isoWeekday(date: string): number {
  const [y, m, d] = splitDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function startOfIsoWeek(date: string): string {
  return addDaysCivil(date, -isoWeekday(date));
}

function isoWeekOf(date: string): { year: number; week: number } {
  const [y, m, d] = splitDate(date);
  const thursday = new Date(Date.UTC(y, m - 1, d - isoWeekday(date) + 3));
  const isoYear = thursday.getUTCFullYear();
  const weekOneMonday = new Date(Date.UTC(isoYear, 0, 4 - isoWeekday(civil(isoYear, 1, 4))));
  const week = Math.round((thursday.getTime() - weekOneMonday.getTime()) / (7 * DAY_MS)) + 1;
  return { year: isoYear, week };
}

function startOfBucket(date: string, interval: Interval): string {
  switch (interval) {
    case "day":
      return date;
    case "week":
      return startOfIsoWeek(date);
    case "month":
      return startOfMonth(date);
    case "quarter":
      return startOfQuarter(date);
    case "year":
      return startOfYear(date);
  }
}

function keyFromCivil(date: string, interval: Interval): string {
  const [y, m] = splitDate(date);
  switch (interval) {
    case "day":
      return date;
    case "week": {
      const week = isoWeekOf(date);
      return `${week.year}-W${pad2(week.week)}`;
    }
    case "month":
      return `${civil(y, m, 1).slice(0, 7)}`;
    case "quarter":
      return `${String(y).padStart(4, "0")}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "year":
      return String(y).padStart(4, "0");
  }
}

function step(date: string, interval: Interval): string {
  switch (interval) {
    case "day":
      return addDaysCivil(date, 1);
    case "week":
      return addDaysCivil(date, 7);
    case "month":
      return addMonthsCivil(date, 1);
    case "quarter":
      return addMonthsCivil(date, 3);
    case "year":
      return addMonthsCivil(date, 12);
  }
}

/** The viewer's calendar date for an instant. */
export function localDateKey(at: Date, tz: string): string {
  return utcToZoned(at, tz).date;
}

export function resolveRange(
  range: RangeSpec,
  now: Date,
  tz: string,
): { from: Date | null; to: Date | null } {
  const today = localDateKey(now, tz);
  let from: string;
  let to: string;

  switch (range.preset) {
    case "this_month":
      from = startOfMonth(today);
      to = addMonthsCivil(from, 1);
      break;
    case "last_month":
      to = startOfMonth(today);
      from = addMonthsCivil(to, -1);
      break;
    case "this_quarter":
      from = startOfQuarter(today);
      to = addMonthsCivil(from, 3);
      break;
    case "last_quarter":
      to = startOfQuarter(today);
      from = addMonthsCivil(to, -3);
      break;
    case "this_year":
      from = startOfYear(today);
      to = addMonthsCivil(from, 12);
      break;
    case "last_year":
      to = startOfYear(today);
      from = addMonthsCivil(to, -12);
      break;
    case "last_30_days":
      from = addDaysCivil(today, -29);
      to = addDaysCivil(today, 1);
      break;
    case "last_90_days":
      from = addDaysCivil(today, -89);
      to = addDaysCivil(today, 1);
      break;
    case "last_12_months":
      from = addMonthsCivil(startOfMonth(today), -11);
      to = addMonthsCivil(startOfMonth(today), 1);
      break;
    case "all_time":
      return { from: null, to: null };
    case "custom": {
      if (range.from === undefined || range.to === undefined) {
        throw new AppError(ERROR_IDS.INSIGHT_DEFINITION_INVALID, "custom range needs two bounds");
      }
      from = range.from;
      // The end date is inclusive; the SQL range is half-open.
      to = addDaysCivil(range.to, 1);
      break;
    }
  }

  return { from: zonedToUtc(from, "00:00", tz), to: zonedToUtc(to, "00:00", tz) };
}

export function bucketKey(at: Date, interval: Interval, tz: string): string {
  return keyFromCivil(localDateKey(at, tz), interval);
}

export function bucketLabel(key: string, interval: Interval): string {
  switch (interval) {
    case "day": {
      const [y, m, d] = splitDate(key);
      return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
    }
    case "week": {
      const match = /^(\d{4})-W(\d{2})$/.exec(key);
      if (match === null) break;
      return `Week ${Number(match[2])}, ${match[1]}`;
    }
    case "month": {
      const match = /^(\d{4})-(\d{2})$/.exec(key);
      if (match === null) break;
      return `${MONTHS_SHORT[Number(match[2]) - 1]} ${match[1]}`;
    }
    case "quarter": {
      const match = /^(\d{4})-Q([1-4])$/.exec(key);
      if (match === null) break;
      return `Q${match[2]} ${match[1]}`;
    }
    case "year":
      if (/^\d{4}$/.test(key)) return key;
      break;
  }
  throw new AppError(ERROR_IDS.INSIGHT_DEFINITION_INVALID, "invalid bucket key", { key, interval });
}

/** Every bucket between from (inclusive) and to (exclusive), so a chart can show zeros. */
export function fillBuckets(from: Date, to: Date, interval: Interval, tz: string): string[] {
  if (to.getTime() <= from.getTime()) return [];
  const first = startOfBucket(localDateKey(from, tz), interval);
  const last = startOfBucket(localDateKey(new Date(to.getTime() - 1), tz), interval);

  const keys: string[] = [];
  for (let cursor = first; cursor <= last; cursor = step(cursor, interval)) {
    keys.push(keyFromCivil(cursor, interval));
  }
  return keys;
}
