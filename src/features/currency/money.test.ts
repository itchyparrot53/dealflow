import { describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  convertBetween,
  dealTotals,
  formatCents,
  formatMoney,
  lineNet,
  lineTax,
  parseBp,
  parseCents,
  parseMilli,
  parseRate,
  roundDiv,
  toBase,
  weighted,
} from "./money";

function caught(fn: () => unknown): AppError | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppError ? error : null;
  }
}

describe("parseCents", () => {
  it("parses whole, fractional and negative amounts into minor units", () => {
    expect(parseCents("0")).toBe(0n);
    expect(parseCents("12.3")).toBe(1230n);
    expect(parseCents("12.34")).toBe(1234n);
    expect(parseCents("-0.5")).toBe(-50n);
    expect(parseCents("-12.34")).toBe(-1234n);
    expect(parseCents("001.20")).toBe(120n);
    expect(parseCents("-0")).toBe(0n);
  });

  it("rejects junk, empty input and more than two decimals", () => {
    for (const bad of ["", ".", "1.", "1.234", "1,2", "abc", "1e3", "+1", " 1"]) {
      expect(caught(() => parseCents(bad))?.id).toBe(ERROR_IDS.CURRENCY_PARSE_FAILED);
    }
  });
});

describe("formatCents", () => {
  it("formats minor units as a plain decimal string without grouping", () => {
    expect(formatCents(1230n)).toBe("12.30");
    expect(formatCents(-50n)).toBe("-0.50");
    expect(formatCents(0n)).toBe("0.00");
    expect(formatCents(5n)).toBe("0.05");
    expect(formatCents(-5n)).toBe("-0.05");
    expect(formatCents(1000000n)).toBe("10000.00");
  });

  it("round trips through parseCents", () => {
    for (const value of ["0.00", "12.30", "-0.50", "1000000.00", "999999999999.99"]) {
      expect(formatCents(parseCents(value))).toBe(value);
    }
  });
});

describe("parseMilli, parseBp and parseRate", () => {
  it("parses thousandths, hundredths of a percent and eight-decimal rates", () => {
    expect(parseMilli("1.5")).toBe(1500n);
    expect(parseMilli("0.333")).toBe(333n);
    expect(parseMilli("12")).toBe(12000n);
    expect(parseBp("100")).toBe(10000n);
    expect(parseBp("12.5")).toBe(1250n);
    expect(parseBp("0")).toBe(0n);
    expect(parseRate("1.08")).toBe(108000000n);
    expect(parseRate("0.00000001")).toBe(1n);
    expect(parseRate("1")).toBe(100000000n);
  });

  it("rejects too many decimals and out-of-range values", () => {
    for (const bad of ["1.2345", "1.2.3", "x"]) {
      expect(caught(() => parseMilli(bad))?.id).toBe(ERROR_IDS.CURRENCY_PARSE_FAILED);
    }
    for (const bad of ["100.01", "-1", "1.234", "x"]) {
      expect(caught(() => parseBp(bad))?.id).toBe(ERROR_IDS.CURRENCY_PARSE_FAILED);
    }
    for (const bad of ["0", "0.00000000", "-1.5", "1.000000001", "x"]) {
      expect(caught(() => parseRate(bad))?.id).toBe(ERROR_IDS.CURRENCY_PARSE_FAILED);
    }
  });
});

describe("roundDiv", () => {
  it("rounds half away from zero for both signs", () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(-5n, 2n)).toBe(-3n);
    expect(roundDiv(4n, 2n)).toBe(2n);
    expect(roundDiv(-4n, 2n)).toBe(-2n);
    expect(roundDiv(1n, 3n)).toBe(0n);
    expect(roundDiv(-1n, 3n)).toBe(0n);
    expect(roundDiv(2n, 3n)).toBe(1n);
    expect(roundDiv(-2n, 3n)).toBe(-1n);
    expect(roundDiv(0n, 7n)).toBe(0n);
  });

  it("refuses a non-positive divisor", () => {
    expect(caught(() => roundDiv(1n, 0n))?.id).toBe(ERROR_IDS.CURRENCY_PARSE_FAILED);
    expect(caught(() => roundDiv(1n, -2n))?.id).toBe(ERROR_IDS.CURRENCY_PARSE_FAILED);
  });
});

describe("lineNet and lineTax", () => {
  it("applies quantity, price and discount with one rounding step", () => {
    expect(lineNet(parseMilli("2"), parseCents("1200.00"), parseBp("10"))).toBe(216000n);
    expect(lineNet(parseMilli("0.333"), parseCents("10.00"), parseBp("0"))).toBe(333n);
    expect(lineNet(parseMilli("1"), parseCents("0.05"), parseBp("50"))).toBe(3n);
    expect(lineNet(parseMilli("1"), parseCents("0.05"), parseBp("0"))).toBe(5n);
  });

  it("computes tax on the rounded net", () => {
    expect(lineTax(216000n, parseBp("20"))).toBe(43200n);
    expect(lineTax(216000n, parseBp("0"))).toBe(0n);
    expect(lineTax(-100n, parseBp("20"))).toBe(-20n);
  });
});

describe("dealTotals", () => {
  it("rounds per line first, then sums", () => {
    const halfCent = {
      qty: parseMilli("1"),
      price: parseCents("0.05"),
      discount: parseBp("50"),
      tax: parseBp("0"),
    };
    const totals = dealTotals([halfCent, halfCent]);
    // Each line nets 0.025 -> 0.03; summing the unrounded values would give 0.05.
    expect(totals.net).toBe(6n);
    expect(totals.tax).toBe(0n);
    expect(totals.gross).toBe(6n);
  });

  it("sums net and tax and derives gross", () => {
    const totals = dealTotals([
      {
        qty: parseMilli("1"),
        price: parseCents("10.05"),
        discount: parseBp("0"),
        tax: parseBp("20"),
      },
      {
        qty: parseMilli("0.333"),
        price: parseCents("10.00"),
        discount: parseBp("0"),
        tax: parseBp("0"),
      },
    ]);
    expect(totals.net).toBe(1338n);
    expect(totals.tax).toBe(201n);
    expect(totals.gross).toBe(1539n);
  });

  it("returns zeroes for no lines", () => {
    expect(dealTotals([])).toEqual({ net: 0n, tax: 0n, gross: 0n });
  });
});

describe("conversion and weighting", () => {
  it("converts to base with the scaled rate", () => {
    expect(toBase(10000n, parseRate("1.08"))).toBe(10800n);
    expect(toBase(-10000n, parseRate("1.08"))).toBe(-10800n);
    expect(toBase(10000n, parseRate("1"))).toBe(10000n);
    expect(toBase(1n, parseRate("0.5"))).toBe(1n);
  });

  it("converts between two currencies through their rates", () => {
    expect(convertBetween(parseCents("100.00"), parseRate("1.08"), parseRate("1.27"))).toBe(8504n);
    expect(convertBetween(parseCents("100.00"), parseRate("1.08"), parseRate("1.08"))).toBe(10000n);
  });

  it("weights by an effective probability, rounding the result", () => {
    expect(weighted(10001n, 50)).toBe(5001n);
    expect(weighted(-10001n, 50)).toBe(-5001n);
    expect(weighted(1n, 50)).toBe(1n);
    expect(weighted(0n, 50)).toBe(0n);
    expect(weighted(1234n, 100)).toBe(1234n);
    expect(weighted(1234n, 0)).toBe(0n);
  });
});

describe("formatMoney", () => {
  it("formats for display with the locale currency layout", () => {
    expect(formatMoney(216000n, "USD")).toBe("$2,160.00");
    expect(formatMoney(-216000n, "USD")).toBe("-$2,160.00");
    expect(formatMoney(5n, "USD")).toBe("$0.05");
  });
});
