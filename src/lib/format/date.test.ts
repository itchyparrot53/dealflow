import { describe, expect, it } from "vitest";
import { daysUntil, formatCalendarDate, formatDueLabel } from "./date";

const NOW = new Date("2026-10-23T10:00:00.000Z");

describe("formatCalendarDate", () => {
  it("omits the year for the current year", () => {
    expect(formatCalendarDate("2026-11-22", NOW)).toBe("Nov 22");
  });

  it("includes a different year", () => {
    expect(formatCalendarDate("2027-01-05", NOW)).toBe("Jan 5, 2027");
  });

  it("keeps the typed calendar day regardless of the host timezone", () => {
    // Parsed in UTC and formatted in UTC: a browser west of Greenwich must not show Nov 21.
    expect(formatCalendarDate("2026-11-22", NOW)).toBe("Nov 22");
  });

  it("returns an empty string for an invalid or empty value", () => {
    expect(formatCalendarDate("", NOW)).toBe("");
    expect(formatCalendarDate("2026-02-31", NOW)).toBe("");
    expect(formatCalendarDate("22/11/2026", NOW)).toBe("");
  });
});

describe("formatDueLabel", () => {
  it("labels an overdue date with its magnitude", () => {
    expect(formatDueLabel("2026-10-20", NOW)).toEqual({
      text: "Overdue by 3 days",
      tone: "overdue",
    });
    expect(formatDueLabel("2026-10-22", NOW)).toEqual({
      text: "Overdue by 1 day",
      tone: "overdue",
    });
  });

  it("labels today and tomorrow", () => {
    expect(formatDueLabel("2026-10-23", NOW)).toEqual({ text: "Due today", tone: "today" });
    expect(formatDueLabel("2026-10-24", NOW)).toEqual({ text: "Due tomorrow", tone: "soon" });
  });

  it("counts the next few days and then names the date", () => {
    expect(formatDueLabel("2026-10-26", NOW)).toEqual({ text: "Due in 3 days", tone: "soon" });
    expect(formatDueLabel("2026-10-30", NOW)).toEqual({ text: "Due in 7 days", tone: "normal" });
    expect(formatDueLabel("2026-11-22", NOW)).toEqual({ text: "In 30 days", tone: "normal" });
    expect(formatDueLabel("2027-01-05", NOW)).toEqual({ text: "In 74 days", tone: "normal" });
  });

  it("returns null for a missing date", () => {
    expect(formatDueLabel("", NOW)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("is zero today and negative in the past", () => {
    expect(daysUntil("2026-10-23", NOW)).toBe(0);
    expect(daysUntil("2026-10-20", NOW)).toBe(-3);
    expect(daysUntil("2026-11-22", NOW)).toBe(30);
  });
});
