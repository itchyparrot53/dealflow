import { describe, expect, it } from "vitest";
import { currencyMinorDigits, formatMoney, formatMoneyCompact, formatNumber } from "./number";

describe("formatMoney", () => {
  it("drops the decimals on a whole major unit in auto mode", () => {
    expect(formatMoney(7_250_000, "USD")).toBe("$72,500");
  });

  it("keeps two decimals when the amount has a fractional part", () => {
    expect(formatMoney(7_250_050, "USD")).toBe("$72,500.50");
  });

  it("always renders two decimals when asked, for documents and prices", () => {
    expect(formatMoney(7_250_000, "USD", { decimals: 2 })).toBe("$72,500.00");
    expect(formatMoney(7_250_050, "GBP", { decimals: 2 })).toBe("£72,500.50");
  });

  it("respects a currency with no minor unit (JPY)", () => {
    expect(currencyMinorDigits("JPY")).toBe(0);
    expect(formatMoney(1_234, "JPY")).toBe("¥1,234");
    expect(formatMoney(1_234, "JPY", { decimals: 2 })).toBe("¥1,234");
  });

  it("keeps the sign on a negative amount", () => {
    expect(formatMoney(-7_250_000, "USD")).toBe("-$72,500");
    expect(formatMoney(-7_250_050, "GBP", { decimals: 2 })).toBe("-£72,500.50");
  });

  it("returns an empty string for a non-finite amount", () => {
    expect(formatMoney(Number.NaN, "USD")).toBe("");
  });
});

describe("formatMoneyCompact", () => {
  it("uses the compact suffix at the four boundaries", () => {
    expect(formatMoneyCompact(99_900, "GBP")).toBe("£999");
    expect(formatMoneyCompact(100_000, "GBP")).toBe("£1K");
    expect(formatMoneyCompact(99_999_900, "GBP")).toBe("£1M");
    expect(formatMoneyCompact(100_000_000, "GBP")).toBe("£1M");
  });

  it("keeps one fraction digit where it reads better", () => {
    expect(formatMoneyCompact(38_000_000, "GBP")).toBe("£380K");
    expect(formatMoneyCompact(120_000_000, "USD")).toBe("$1.2M");
  });
});

describe("formatNumber", () => {
  it("groups a plain number", () => {
    expect(formatNumber(18_500_000)).toBe("18,500,000");
  });

  it("compacts a plain number", () => {
    expect(formatNumber(18_500_000, { compact: true })).toBe("18.5M");
  });
});
