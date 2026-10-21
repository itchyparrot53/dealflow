import { describe, expect, test } from "vitest";
import { nextOccurrence } from "./next";
import type { RecurrenceRule } from "./rule";

const UTC = "UTC";
const LONDON = "Europe/London";

function rule(partial: Partial<RecurrenceRule> & Pick<RecurrenceRule, "freq">): RecurrenceRule {
  return { interval: 1, end: { type: "never" }, ...partial };
}

describe("nextOccurrence", () => {
  test("daily every 3 days", () => {
    const next = nextOccurrence(
      rule({ freq: "daily", interval: 3 }),
      { dueAt: new Date("2026-01-01T09:00:00Z"), allDay: false },
      1,
      1,
      UTC,
    );
    expect(next?.toISOString()).toBe("2026-01-04T09:00:00.000Z");
  });

  test("weekly Mon and Thu every 2 weeks from a Thursday lands on the Monday 11 days later", () => {
    const next = nextOccurrence(
      rule({ freq: "weekly", interval: 2, byWeekday: ["mon", "thu"] }),
      { dueAt: new Date("2026-01-01T09:00:00Z"), allDay: false },
      1,
      1,
      UTC,
    );
    expect(next?.toISOString()).toBe("2026-01-12T09:00:00.000Z");
  });

  test("weekly Mon and Thu from a Monday stays in the same week", () => {
    const next = nextOccurrence(
      rule({ freq: "weekly", interval: 2, byWeekday: ["mon", "thu"] }),
      { dueAt: new Date("2026-01-05T09:00:00Z"), allDay: false },
      5,
      1,
      UTC,
    );
    expect(next?.toISOString()).toBe("2026-01-08T09:00:00.000Z");
  });

  test("monthly anchored on the 31st clamps to February and comes back on 31 March", () => {
    const february = nextOccurrence(
      rule({ freq: "monthly" }),
      { dueAt: new Date("2026-01-31T09:00:00Z"), allDay: false },
      31,
      1,
      UTC,
    );
    expect(february?.toISOString()).toBe("2026-02-28T09:00:00.000Z");

    const march = nextOccurrence(
      rule({ freq: "monthly" }),
      { dueAt: new Date("2026-02-28T09:00:00Z"), allDay: false },
      31,
      2,
      UTC,
    );
    expect(march?.toISOString()).toBe("2026-03-31T09:00:00.000Z");
  });

  test("yearly from 29 February clamps to 28 February", () => {
    const next = nextOccurrence(
      rule({ freq: "yearly" }),
      { dueAt: new Date("2028-02-29T09:00:00Z"), allDay: false },
      29,
      1,
      UTC,
    );
    expect(next?.toISOString()).toBe("2029-02-28T09:00:00.000Z");
  });

  test("a count of 3 stops after the third occurrence", () => {
    const counted = rule({ freq: "daily", end: { type: "count", count: 3 } });
    const second = nextOccurrence(
      counted,
      { dueAt: new Date("2026-01-01T09:00:00Z"), allDay: false },
      1,
      1,
      UTC,
    );
    expect(second?.toISOString()).toBe("2026-01-02T09:00:00.000Z");

    const third = nextOccurrence(
      counted,
      { dueAt: new Date("2026-01-02T09:00:00Z"), allDay: false },
      1,
      2,
      UTC,
    );
    expect(third?.toISOString()).toBe("2026-01-03T09:00:00.000Z");

    const none = nextOccurrence(
      counted,
      { dueAt: new Date("2026-01-03T09:00:00Z"), allDay: false },
      1,
      3,
      UTC,
    );
    expect(none).toBeNull();
  });

  test("until is inclusive and stops the day after", () => {
    const until = rule({ freq: "daily", end: { type: "until", date: "2026-01-03" } });
    expect(
      nextOccurrence(
        until,
        { dueAt: new Date("2026-01-02T09:00:00Z"), allDay: false },
        1,
        2,
        UTC,
      )?.toISOString(),
    ).toBe("2026-01-03T09:00:00.000Z");
    expect(
      nextOccurrence(until, { dueAt: new Date("2026-01-03T09:00:00Z"), allDay: false }, 1, 3, UTC),
    ).toBeNull();
  });

  test("keeps 09:00 London across the March DST change", () => {
    const next = nextOccurrence(
      rule({ freq: "daily" }),
      { dueAt: new Date("2026-03-28T09:00:00Z"), allDay: false },
      1,
      1,
      LONDON,
    );
    expect(next?.toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  test("all-day occurrences keep local midnight", () => {
    const next = nextOccurrence(
      rule({ freq: "daily" }),
      { dueAt: new Date("2026-01-01T00:00:00Z"), allDay: true },
      1,
      1,
      UTC,
    );
    expect(next?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});
