import {
  addDays,
  utcToZoned,
  WEEKDAYS,
  weekdayOf,
  zonedToUtc,
} from "@/features/scheduling/zonedTime";
import type { RecurrenceRule } from "./rule";

// Next-occurrence arithmetic (6.5). All calendar stepping happens on the local date string in the
// assignee's zone, then the wall clock is resolved back to an instant, so a DST change keeps the
// same local time instead of drifting by an hour.

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return MONTH_LENGTHS[month - 1] ?? 30;
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

function localParts(date: string): LocalDate {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

function formatLocal({ year, month, day }: LocalDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextWeekly(date: string, rule: RecurrenceRule): string {
  if (rule.byWeekday === undefined) return addDays(date, 7 * rule.interval);

  const currentIndex = WEEKDAYS.indexOf(weekdayOf(date));
  const wanted = [...new Set(rule.byWeekday.map((day) => WEEKDAYS.indexOf(day)))].sort(
    (a, b) => a - b,
  );
  const laterThisWeek = wanted.find((index) => index > currentIndex);
  if (laterThisWeek !== undefined) return addDays(date, laterThisWeek - currentIndex);

  // No listed weekday is left this week: jump `interval` weeks past this week's Monday and take
  // the first listed day, which is what "every 2 weeks on Mon, Thu" means from a Thursday.
  const monday = addDays(date, -currentIndex);
  return addDays(monday, 7 * rule.interval + (wanted[0] ?? 0));
}

function nextMonthly(date: string, rule: RecurrenceRule, anchorDay: number): string {
  const local = localParts(date);
  const totalMonths = local.year * 12 + (local.month - 1) + rule.interval;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return formatLocal({ year, month, day: Math.min(anchorDay, daysInMonth(year, month)) });
}

function nextYearly(date: string, rule: RecurrenceRule, anchorDay: number): string {
  const local = localParts(date);
  const year = local.year + rule.interval;
  return formatLocal({
    year,
    month: local.month,
    day: Math.min(anchorDay, daysInMonth(year, local.month)),
  });
}

export function nextOccurrence(
  rule: RecurrenceRule,
  current: { dueAt: Date; allDay: boolean },
  anchorDay: number,
  occurrence: number,
  tz: string,
): Date | null {
  const zoned = utcToZoned(current.dueAt, tz);

  let nextDate: string;
  switch (rule.freq) {
    case "daily":
      nextDate = addDays(zoned.date, rule.interval);
      break;
    case "weekly":
      nextDate = nextWeekly(zoned.date, rule);
      break;
    case "monthly":
      nextDate = nextMonthly(zoned.date, rule, anchorDay);
      break;
    case "yearly":
      nextDate = nextYearly(zoned.date, rule, anchorDay);
      break;
  }

  // `occurrence` counts the current activity from 1; the end is checked against the next one.
  if (rule.end.type === "count" && occurrence >= rule.end.count) return null;
  if (rule.end.type === "until" && nextDate > rule.end.date) return null;

  return zonedToUtc(nextDate, zoned.time, tz);
}
