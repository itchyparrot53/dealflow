import { type Cents, parseCents, type Rate, toBase, weighted } from "./money";

// Shared totals for the board, the deals list and the forecast, so all three
// convert and weight the same way. Reads load the rate map once through
// loadRateMap() and pass it in.

const BASE_RATE: Rate = 100_000_000n;

export type RateMap = { base: string; rates: ReadonlyMap<string, Rate> };

export type MoneyDeal = {
  id: string;
  value: string | null;
  currency: string;
  probability: number;
};

export type Summary = {
  total: Cents;
  weighted: Cents;
  counted: number;
  excluded: { id: string; currency: string }[];
};

export function rateFor(map: RateMap, code: string): Rate | null {
  // The base currency always has a rate of 1 and is never stored.
  if (code === map.base) return BASE_RATE;
  return map.rates.get(code) ?? null;
}

export function summarize(deals: readonly MoneyDeal[], map: RateMap): Summary {
  let total = 0n;
  let weightedTotal = 0n;
  let counted = 0;
  const excluded: { id: string; currency: string }[] = [];

  for (const deal of deals) {
    // A deal with no value contributes 0 but is still counted (never dropped).
    if (deal.value === null) {
      counted += 1;
      continue;
    }
    const rate = rateFor(map, deal.currency);
    if (rate === null) {
      // Never add an unconverted amount; the caller lists these to the user.
      excluded.push({ id: deal.id, currency: deal.currency });
      continue;
    }
    const base = toBase(parseCents(deal.value), rate);
    total += base;
    weightedTotal += weighted(base, deal.probability);
    counted += 1;
  }

  return { total, weighted: weightedTotal, counted, excluded };
}
