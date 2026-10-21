import { describe, expect, test } from "vitest";
import { describeRule, type RecurrenceRule, recurrenceRuleSchema } from "./rule";

describe("recurrenceRuleSchema", () => {
  test("accepts a weekly rule with weekdays and an until end", () => {
    const parsed = recurrenceRuleSchema.safeParse({
      freq: "weekly",
      interval: 2,
      byWeekday: ["mon", "thu"],
      end: { type: "until", date: "2026-12-31" },
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects weekdays on a non-weekly rule", () => {
    const parsed = recurrenceRuleSchema.safeParse({
      freq: "daily",
      interval: 1,
      byWeekday: ["mon"],
      end: { type: "never" },
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects weekdays that repeat", () => {
    const parsed = recurrenceRuleSchema.safeParse({
      freq: "weekly",
      interval: 1,
      byWeekday: ["mon", "mon"],
      end: { type: "never" },
    });
    expect(parsed.success).toBe(false);
  });

  test("clamps the interval to 1..99", () => {
    const base = { freq: "daily", end: { type: "never" } };
    expect(recurrenceRuleSchema.safeParse({ ...base, interval: 0 }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ ...base, interval: 100 }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ ...base, interval: 99 }).success).toBe(true);
  });

  test("clamps a count to 2..500", () => {
    const base = { freq: "daily", interval: 1 };
    expect(
      recurrenceRuleSchema.safeParse({ ...base, end: { type: "count", count: 1 } }).success,
    ).toBe(false);
    expect(
      recurrenceRuleSchema.safeParse({ ...base, end: { type: "count", count: 501 } }).success,
    ).toBe(false);
    expect(
      recurrenceRuleSchema.safeParse({ ...base, end: { type: "count", count: 500 } }).success,
    ).toBe(true);
  });

  test("rejects a malformed until date", () => {
    const parsed = recurrenceRuleSchema.safeParse({
      freq: "daily",
      interval: 1,
      end: { type: "until", date: "31/12/2026" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("describeRule", () => {
  test("describes the plan's weekly example", () => {
    const rule: RecurrenceRule = {
      freq: "weekly",
      interval: 2,
      byWeekday: ["mon", "thu"],
      end: { type: "until", date: "2026-12-31" },
    };
    expect(describeRule(rule)).toBe("Every 2 weeks on Mon, Thu until 31 Dec 2026");
  });

  test("describes a daily rule with a count", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1, end: { type: "count", count: 3 } };
    expect(describeRule(rule)).toBe("Every day for 3 occurrences");
  });

  test("describes monthly and yearly rules", () => {
    expect(describeRule({ freq: "monthly", interval: 1, end: { type: "never" } })).toBe(
      "Every month",
    );
    expect(describeRule({ freq: "yearly", interval: 2, end: { type: "never" } })).toBe(
      "Every 2 years",
    );
  });
});
