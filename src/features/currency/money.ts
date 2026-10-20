import { AppError, ERROR_IDS } from "@/constants/errorIds";

// Pure money math for Part 3. Every amount is a bigint in minor units so no
// binary floating point ever touches a money value. Decimal strings are the
// wire and database format; the parsers below are the only place they become
// integers, and their inputs are pre-validated by the Zod schemas.

export type Cents = bigint; // 2 decimals
export type Milli = bigint; // quantity, 3 decimals
export type Bp = bigint; // percent in hundredths: 12.5% = 1250n, 100% = 10000n
export type Rate = bigint; // rate scaled by 1e8

const MILLI_SCALE = 1000n;
const BP_SCALE = 10000n;
const PERCENT_SCALE = 100n; // weighted() denominator: probability 0..100
const RATE_SCALE = 100_000_000n;

const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

function parseError(label: string): AppError {
  return new AppError(
    ERROR_IDS.CURRENCY_PARSE_FAILED,
    `Invalid ${label} value: input must be pre-validated`,
    { label },
  );
}

function parseDecimal(value: string, decimals: number, label: string): bigint {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) throw parseError(label);
  const fraction = match[3] ?? "";
  if (fraction.length > decimals) throw parseError(label);
  const digits = `${match[2]}${fraction.padEnd(decimals, "0")}`;
  const scaled = BigInt(digits);
  return match[1] === "-" ? -scaled : scaled;
}

export function parseCents(s: string): Cents {
  return parseDecimal(s, 2, "amount");
}

export function formatCents(c: Cents): string {
  const negative = c < 0n;
  const absolute = negative ? -c : c;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function parseMilli(s: string): Milli {
  return parseDecimal(s, 3, "quantity");
}

export function parseBp(s: string): Bp {
  const value = parseDecimal(s, 2, "percent");
  if (value < 0n || value > BP_SCALE) throw parseError("percent");
  return value;
}

export function parseRate(s: string): Rate {
  const value = parseDecimal(s, 8, "rate");
  if (value <= 0n) throw parseError("rate");
  return value;
}

// Half away from zero, matching how invoices round: 5/2 = 3, -5/2 = -3.
export function roundDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n) {
    throw new AppError(ERROR_IDS.CURRENCY_PARSE_FAILED, "roundDiv needs a positive divisor", {
      divisor: d.toString(),
    });
  }
  const quotient = n / d;
  const remainder = n % d;
  if (remainder === 0n) return quotient;
  const doubled = (remainder < 0n ? -remainder : remainder) * 2n;
  if (doubled < d) return quotient;
  return quotient + (n < 0n ? -1n : 1n);
}

export function lineNet(qty: Milli, price: Cents, discount: Bp): Cents {
  return roundDiv(qty * price * (BP_SCALE - discount), MILLI_SCALE * BP_SCALE);
}

export function lineTax(net: Cents, tax: Bp): Cents {
  return roundDiv(net * tax, BP_SCALE);
}

export function dealTotals(lines: readonly { qty: Milli; price: Cents; discount: Bp; tax: Bp }[]): {
  net: Cents;
  tax: Cents;
  gross: Cents;
} {
  let net = 0n;
  let tax = 0n;
  // Rounding per line first keeps the printed line values equal to their sum.
  for (const line of lines) {
    const lineTotal = lineNet(line.qty, line.price, line.discount);
    net += lineTotal;
    tax += lineTax(lineTotal, line.tax);
  }
  return { net, tax, gross: net + tax };
}

export function toBase(amount: Cents, rate: Rate): Cents {
  return roundDiv(amount * rate, RATE_SCALE);
}

export function convertBetween(amount: Cents, from: Rate, to: Rate): Cents {
  return roundDiv(amount * from, to);
}

export function weighted(amount: Cents, probability: number): Cents {
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) {
    throw new AppError(ERROR_IDS.CURRENCY_PARSE_FAILED, "Probability must be an integer 0..100", {
      probability,
    });
  }
  return roundDiv(amount * BigInt(probability), PERCENT_SCALE);
}

// Display only. Builds the locale layout from Intl parts around the exact
// integer digits, so a grouped number never becomes a JS float.
export function formatMoney(c: Cents, currency: string, locale = "en-US"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const negative = c < 0n;
  const absolute = negative ? -c : c;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const groupedWhole = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(whole);
  const rendered = formatter
    .formatToParts(0n)
    .map((part) => {
      if (part.type === "integer") return groupedWhole;
      if (part.type === "fraction") return fraction;
      return part.value;
    })
    .join("");
  return negative ? `-${rendered}` : rendered;
}
