import { describe, expect, it } from "vitest";
import { averageRates, compareToAverage, type InsightRates } from "./insightsShared";

function rates(over: Partial<InsightRates>): InsightRates {
  return {
    openRate: null,
    clickRate: null,
    ctor: null,
    unsubscribeRate: null,
    bounceRate: null,
    ...over,
  };
}

describe("insight averages and arrows", () => {
  it("averages each rate across the campaigns that have a denominator", () => {
    const average = averageRates([
      rates({ openRate: 0.5, clickRate: 0.2, ctor: 0.4, unsubscribeRate: 0.05, bounceRate: 0.1 }),
      rates({ openRate: 0.3, clickRate: 0.1, ctor: 1 / 3, bounceRate: 0.2 }),
      rates({}),
    ]);
    expect(average.openRate).toBeCloseTo(0.4, 10);
    expect(average.clickRate).toBeCloseTo(0.15, 10);
    expect(average.ctor).toBeCloseTo((0.4 + 1 / 3) / 2, 10);
    expect(average.unsubscribeRate).toBeCloseTo(0.05, 10);
    expect(average.bounceRate).toBeCloseTo(0.15, 10);
  });

  it("shows an arrow only beyond 10% relative difference", () => {
    expect(compareToAverage(0.45, 0.4)).toBe("up");
    expect(compareToAverage(0.42, 0.4)).toBeNull();
    expect(compareToAverage(0.37, 0.4)).toBeNull();
    expect(compareToAverage(0.3, 0.4)).toBe("down");
    expect(compareToAverage(0.45, 0)).toBeNull();
    expect(compareToAverage(null, 0.4)).toBeNull();
    expect(compareToAverage(0.4, null)).toBeNull();
  });

  it("returns all nulls when no campaign has a usable rate", () => {
    const average = averageRates([rates({}), rates({})]);
    expect(average).toEqual({
      openRate: null,
      clickRate: null,
      ctor: null,
      unsubscribeRate: null,
      bounceRate: null,
    });
  });
});
