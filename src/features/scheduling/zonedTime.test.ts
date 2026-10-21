import { describe, expect, it } from "vitest";
import { addDays, isValidTimeZone, tzOffsetMinutes, utcToZoned, zonedToUtc } from "./zonedTime";

describe("tzOffsetMinutes", () => {
  it("reports summer time in London and winter time in January", () => {
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "Europe/London")).toBe(60);
    expect(tzOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Europe/London")).toBe(0);
  });

  it("reports a half-hour zone", () => {
    expect(tzOffsetMinutes(new Date("2026-10-19T12:00:00Z"), "Asia/Kolkata")).toBe(330);
  });

  it("reports negative offsets for New York", () => {
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/New_York")).toBe(-240);
  });
});

describe("zonedToUtc", () => {
  it("resolves a London spring-forward gap forward, not backward", () => {
    // 01:30 on 2026-03-29 does not exist: the clocks jump from 01:00 GMT to 02:00 BST.
    // Forward by the gap lands on 02:30 BST, which is 01:30 UTC.
    expect(zonedToUtc("2026-03-29", "01:30", "Europe/London").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });

  it("takes the first occurrence of a London fall-back time", () => {
    // 01:30 on 2026-10-25 happens twice: 00:30 UTC (BST) and 01:30 UTC (GMT).
    expect(zonedToUtc("2026-10-25", "01:30", "Europe/London").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("converts an ordinary London wall clock", () => {
    expect(zonedToUtc("2026-10-19", "09:00", "Europe/London").toISOString()).toBe(
      "2026-10-19T08:00:00.000Z",
    );
  });

  it("handles a New York spring-forward gap", () => {
    // 02:30 on 2026-03-08 does not exist; forward by the gap is 03:30 EDT = 07:30 UTC.
    expect(zonedToUtc("2026-03-08", "02:30", "America/New_York").toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
  });

  it("handles New York summer and winter wall clocks", () => {
    expect(zonedToUtc("2026-07-01", "09:00", "America/New_York").toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
    expect(zonedToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("handles India's half-hour offset", () => {
    expect(zonedToUtc("2026-10-19", "09:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-10-19T03:30:00.000Z",
    );
  });
});

describe("utcToZoned", () => {
  it("round-trips a London instant and reports its weekday", () => {
    const at = zonedToUtc("2026-10-19", "09:00", "Europe/London");
    expect(utcToZoned(at, "Europe/London")).toEqual({
      date: "2026-10-19",
      time: "09:00",
      weekday: "mon",
    });
  });

  it("round-trips every weekday label", () => {
    const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    for (let i = 0; i < weekdays.length; i += 1) {
      const at = zonedToUtc(addDays("2026-10-19", i), "12:00", "UTC");
      expect(utcToZoned(at, "UTC").weekday).toBe(weekdays[i]);
    }
  });

  it("crosses the date line correctly", () => {
    // 23:30 UTC on the 19th is already the 20th in Kolkata.
    expect(utcToZoned(new Date("2026-10-19T23:30:00Z"), "Asia/Kolkata")).toEqual({
      date: "2026-10-20",
      time: "05:00",
      weekday: "tue",
    });
  });
});

describe("addDays", () => {
  it("walks forward across a month end", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("walks backward across a month start", () => {
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is unaffected by a DST change", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects nonsense and empty strings", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
