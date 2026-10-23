// Display-only money and number formatting (PLAN-PART12.md 6.5, U10). Amounts stay integer minor
// units everywhere; these helpers only decide how they read. The app has one pinned display locale
// (en-US, the locale every Part 1 to 11 screen already used), so the output does not change with
// the browser's locale.

const LOCALE = "en-US";

export interface MoneyOptions {
  // "auto" drops the decimals on a whole major unit (a 72,500 total reads 72,500), otherwise 2;
  // 2 keeps the currency's own minor-unit digits for prices, documents, invoices and payments.
  decimals?: "auto" | 2;
}

// The currency's own minor-unit digits: 2 for USD/GBP/EUR, 0 for JPY, 3 for BHD. Forcing two
// decimals on JPY would invent a subunit the currency does not have.
export function currencyMinorDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat(LOCALE, { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

function renderCurrency(
  amountMinor: bigint,
  currency: string,
  currencyDigits: number,
  fractionDigits: number,
): string {
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  // The scale always comes from the currency's minor unit; fractionDigits only decides how much of
  // that fraction is shown (auto drops it for a whole major unit).
  const scale = 10n ** BigInt(currencyDigits);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(currencyDigits, "0").slice(0, fractionDigits);
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  // Build the layout from Intl parts around the exact integer digits, so a grouped amount never
  // passes through a JS float.
  const groupedWhole = new Intl.NumberFormat(LOCALE, {
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

export function formatMoney(
  amountMinor: number,
  currency: string,
  opts?: MoneyOptions,
): string {
  if (!Number.isFinite(amountMinor)) return "";
  const minor = BigInt(Math.round(amountMinor));
  const digits = currencyMinorDigits(currency);
  const isWhole = digits === 0 || minor % 10n ** BigInt(digits) === 0n;
  const fractionDigits = opts?.decimals === 2 ? digits : isWhole ? 0 : digits;
  return renderCurrency(minor, currency, digits, fractionDigits);
}

// Axis ticks and tight cells: $380K, $1.2M, 18.5M. en-US is what spells the suffixes in upper case.
export function formatMoneyCompact(amountMinor: number, currency: string): string {
  if (!Number.isFinite(amountMinor)) return "";
  const digits = currencyMinorDigits(currency);
  const major = amountMinor / 10 ** digits;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(major);
}

export function formatNumber(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(LOCALE, {
    notation: opts?.compact === true ? "compact" : "standard",
    maximumFractionDigits: opts?.compact === true ? 1 : 2,
  }).format(value);
}
