// Calendar-date formatting for project and task due dates. The API stores DATE columns as
// YYYY-MM-DD, so every helper here works on the calendar date in UTC and formats it in UTC:
// otherwise a browser west of Greenwich shows the previous day for a date the user typed.
const LOCALE = "en-US";
const DAY_MS = 86_400_000;

export type DueTone = "overdue" | "today" | "soon" | "normal";

export interface DueLabel {
  text: string;
  tone: DueTone;
}

function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject rolled-over dates such as 2026-02-31.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDayStart(to) - utcDayStart(from)) / DAY_MS);
}

// "Nov 22" in the current year, "Nov 22, 2027" otherwise. Invalid input returns "" so a table
// cell can fall back to its empty state.
export function formatCalendarDate(value: string, now: Date = new Date()): string {
  const date = parseCalendarDate(value);
  if (date === null) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    year: date.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Short relative label used on task cards and due-date cells: "Overdue by 3 days", "Due today",
// "Due tomorrow", "Due in 5 days", or "Due Nov 22" beyond a week. Tone drives the colour, never
// the text alone.
export function formatDueLabel(value: string, now: Date = new Date()): DueLabel | null {
  const date = parseCalendarDate(value);
  if (date === null) return null;
  const days = daysBetween(now, date);
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      text: overdue === 1 ? "Overdue by 1 day" : `Overdue by ${overdue} days`,
      tone: "overdue",
    };
  }
  if (days === 0) return { text: "Due today", tone: "today" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  if (days <= 3) return { text: `Due in ${days} days`, tone: "soon" };
  if (days <= 7) return { text: `Due in ${days} days`, tone: "normal" };
  return { text: `In ${days} days`, tone: "normal" };
}

// Whole-day difference between a calendar date and now, negative when the date has passed.
export function daysUntil(value: string, now: Date = new Date()): number | null {
  const date = parseCalendarDate(value);
  return date === null ? null : daysBetween(now, date);
}
