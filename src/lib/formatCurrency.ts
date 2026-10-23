import { currencyMinorDigits, formatMoney } from "@/lib/format/number";

// Shared money formatter for compact UI surfaces (board cards, column totals, deal values). Deal
// values are stored as decimal strings in major units; Part 12's 6.5 rule shows no decimals on a
// whole amount and two when it has cents, so the value is converted to minor units first.
export function formatCurrency(value: string | number, currency = "USD"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return formatMoney(Math.round(n * 10 ** currencyMinorDigits(currency)), currency);
}
