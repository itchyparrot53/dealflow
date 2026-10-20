import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { currencyRates, dealProducts, dealTerms, stageProbabilities } from "@/db/schema/sales";
import { formatCents, parseCents, parseRate, toBase } from "@/features/currency/money";
import { readBaseCurrency } from "@/features/currency/rates";

// The deal header and Summary need only a few product facts: whether lines exist
// (the value field becomes calculated), the deal currency, the effective
// probability and the value converted to base for the "≈" line. Keeping this in
// one read avoids three client round trips on every deal page.
export interface DealProductSummary {
  lineCount: number;
  currency: string;
  stageProbability: number | null;
  effectiveProbability: number;
  // Decimal string in the base currency, or null when there is no value or no rate.
  valueBase: string | null;
}

const DEFAULT_PROBABILITY = 100;

export async function loadDealProductSummary(
  db: Db,
  deal: { id: string; stageId: string; value: string | null },
  signal: AbortSignal,
): Promise<DealProductSummary> {
  const [base, [terms], [stageRow], [count]] = await Promise.all([
    readBaseCurrency(db, signal),
    db
      .select({ currency: dealTerms.currency, probability: dealTerms.probability })
      .from(dealTerms)
      .where(eq(dealTerms.dealId, deal.id)),
    db
      .select({ probability: stageProbabilities.probability })
      .from(stageProbabilities)
      .where(eq(stageProbabilities.stageId, deal.stageId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dealProducts)
      .where(eq(dealProducts.dealId, deal.id)),
  ]);
  signal.throwIfAborted();

  const currency = terms?.currency ?? base;
  const stageProbability = stageRow?.probability ?? null;
  const effectiveProbability = terms?.probability ?? stageProbability ?? DEFAULT_PROBABILITY;

  let valueBase: string | null = null;
  if (deal.value !== null) {
    if (currency === base) {
      valueBase = deal.value;
    } else {
      const [rateRow] = await db
        .select({ rate: currencyRates.rateToBase })
        .from(currencyRates)
        .where(eq(currencyRates.code, currency));
      if (rateRow !== undefined) {
        valueBase = formatCents(toBase(parseCents(deal.value), parseRate(rateRow.rate)));
      }
    }
  }

  return {
    lineCount: count?.count ?? 0,
    currency,
    stageProbability,
    effectiveProbability,
    valueBase,
  };
}
