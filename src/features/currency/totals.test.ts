import { describe, expect, it } from "vitest";
import { parseRate } from "./money";
import { type MoneyDeal, type RateMap, rateFor, summarize } from "./totals";

const BASE = parseRate("1");
const MAP: RateMap = {
  base: "USD",
  rates: new Map([
    ["EUR", parseRate("1.08")],
    ["GBP", parseRate("1.27")],
  ]),
};

function deal(overrides: Partial<MoneyDeal> = {}): MoneyDeal {
  return { id: "deal-1", value: "1000.00", currency: "USD", probability: 100, ...overrides };
}

describe("rateFor", () => {
  it("treats the base currency as rate 1 even without an entry", () => {
    expect(rateFor(MAP, "USD")).toBe(BASE);
  });

  it("returns the stored rate or null for a missing one", () => {
    expect(rateFor(MAP, "EUR")).toBe(parseRate("1.08"));
    expect(rateFor(MAP, "JPY")).toBeNull();
  });
});

describe("summarize", () => {
  it("converts each deal to base, then weights it, then sums", () => {
    const summary = summarize([deal()], MAP);
    expect(summary.counted).toBe(1);
    expect(summary.total).toBe(100000n);
    expect(summary.weighted).toBe(100000n);
    expect(summary.excluded).toEqual([]);
  });

  it("weights the converted amount by the effective probability", () => {
    const summary = summarize([deal({ value: "100.00", currency: "EUR", probability: 50 })], MAP);
    // 100.00 EUR * 1.08 = 108.00 USD; 50% = 54.00 USD.
    expect(summary.total).toBe(10800n);
    expect(summary.weighted).toBe(5400n);
  });

  it("counts a null value as zero instead of dropping the deal", () => {
    const summary = summarize([deal({ value: null })], MAP);
    expect(summary.counted).toBe(1);
    expect(summary.total).toBe(0n);
    expect(summary.weighted).toBe(0n);
    expect(summary.excluded).toEqual([]);
  });

  it("lists deals whose currency has no rate and never adds them unconverted", () => {
    const summary = summarize(
      [deal({ id: "usd" }), deal({ id: "jpy", value: "500.00", currency: "JPY" })],
      MAP,
    );
    expect(summary.counted).toBe(1);
    expect(summary.total).toBe(100000n);
    expect(summary.excluded).toEqual([{ id: "jpy", currency: "JPY" }]);
  });

  it("rounds per deal before summing", () => {
    const halfCentMap: RateMap = { base: "USD", rates: new Map([["EUR", parseRate("1.5")]]) };
    const summary = summarize(
      [
        deal({ id: "a", value: "0.01", currency: "EUR" }),
        deal({ id: "b", value: "0.01", currency: "EUR" }),
      ],
      halfCentMap,
    );
    // 0.015 rounds to 0.02 per deal; two deals sum to 0.04, not the unrounded 0.03.
    expect(summary.total).toBe(4n);
  });

  it("returns a zero summary for no deals", () => {
    expect(summarize([], MAP)).toEqual({ total: 0n, weighted: 0n, counted: 0, excluded: [] });
  });
});
