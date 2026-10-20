import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { deals } from "@/db/schema/deals";
import { pipelines } from "@/db/schema/pipelines";
import { dealProducts, dealTerms, products } from "@/db/schema/sales";
import {
  convertBetween,
  dealTotals,
  formatCents,
  parseBp,
  parseCents,
  parseMilli,
} from "@/features/currency/money";
import { loadRateMap, readBaseCurrency } from "@/features/currency/rates";
import { moneyString, percentString, quantityString } from "@/features/currency/schemas";
import { type RateMap, rateFor } from "@/features/currency/totals";
import { loadEditableDeal, toVisibleDeal } from "@/features/deals/dealAuth";
import { recordDealValueChange } from "@/features/deals/dealUpdate";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";

// Deal line items. Every mutation runs in one transaction: write the line, recompute
// the deal totals from ALL lines and, when the net changed, write deals.value through
// the manual-edit change-log/event path. The value is always a decimal string.

const lineFields = z.object({
  quantity: quantityString.optional(),
  itemPrice: moneyString.optional(),
  discountPercent: percentString.optional(),
  taxPercent: percentString.optional(),
  comments: z.string().trim().max(1000).nullable().optional(),
});

export const addDealLineInput = lineFields.extend({
  dealId: z.string().uuid(),
  productId: z.string().uuid(),
});
export const updateDealLineInput = lineFields.extend({ lineId: z.string().uuid() });
export const removeDealLineInput = z.object({ lineId: z.string().uuid() });

export type DealLine = typeof dealProducts.$inferSelect;
type DealRow = typeof deals.$inferSelect;

function invalidInput(): AppError {
  return new AppError(ERROR_IDS.PRODUCT_INPUT_INVALID, "Deal line input failed validation");
}

function rateMissing(code: string): AppError {
  return new AppError(ERROR_IDS.CURRENCY_RATE_MISSING, `No exchange rate for ${code}`, { code });
}

async function lockDeal(tx: DbOrTx, dealId: string): Promise<DealRow | null> {
  const [row] = await tx.select().from(deals).where(eq(deals.id, dealId)).for("update");
  return row ?? null;
}

async function dealCurrency(db: DbOrTx, dealId: string, signal: AbortSignal): Promise<string> {
  const [row] = await db
    .select({ currency: dealTerms.currency })
    .from(dealTerms)
    .where(eq(dealTerms.dealId, dealId));
  return row?.currency ?? readBaseCurrency(db, signal);
}

type Converted = { value: string } | { missing: string };

function convertPrice(price: string, from: string, to: string, map: RateMap): Converted {
  const fromRate = rateFor(map, from);
  if (fromRate === null) return { missing: from };
  const toRate = rateFor(map, to);
  if (toRate === null) return { missing: to };
  return { value: formatCents(convertBetween(parseCents(price), fromRate, toRate)) };
}

// Recomputing from every line (not incrementally) keeps the value correct after an
// edit that changes quantity, price, discount or tax. Zero lines leaves the last
// total in place, which is what the plan specifies for removing the final line.
async function syncDealValue(
  tx: DbOrTx,
  deal: DealRow,
  actorId: string,
  signal: AbortSignal,
): Promise<DealRow> {
  const rows = await tx
    .select({
      quantity: dealProducts.quantity,
      itemPrice: dealProducts.itemPrice,
      discountPercent: dealProducts.discountPercent,
      taxPercent: dealProducts.taxPercent,
    })
    .from(dealProducts)
    .where(eq(dealProducts.dealId, deal.id));
  if (rows.length === 0) return deal;
  const totals = dealTotals(
    rows.map((row) => ({
      qty: parseMilli(row.quantity),
      price: parseCents(row.itemPrice),
      discount: parseBp(row.discountPercent),
      tax: parseBp(row.taxPercent),
    })),
  );
  return recordDealValueChange(
    tx,
    { dealId: deal.id, actorId, before: deal, value: formatCents(totals.net) },
    signal,
  );
}

export async function listDealLines(
  db: Db,
  actor: PermSetUser,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<DealLine[], AppError>> {
  const visible = await assertDealVisible(db, actor, dealId, signal);
  if (!visible.ok) return visible;
  return ok(
    await db
      .select()
      .from(dealProducts)
      .where(eq(dealProducts.dealId, dealId))
      .orderBy(dealProducts.position),
  );
}

// A line read must not reveal lines of a deal the viewer cannot see. Reuses the
// shared visibility pair (canSee + toVisibleDeal) instead of a new predicate.
export async function assertDealVisible(
  db: DbOrTx,
  actor: PermSetUser,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  const [deal] = await db
    .select({
      ownerId: deals.ownerId,
      visibilityLevel: deals.visibilityLevel,
      visibilityGroupId: deals.visibilityGroupId,
      visibleToUserIds: deals.visibleToUserIds,
      pipelineId: deals.pipelineId,
    })
    .from(deals)
    .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)));
  if (deal === undefined) {
    return err(new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId }));
  }
  const [pipeline] = await db
    .select({ visibilityGroupId: pipelines.visibilityGroupId })
    .from(pipelines)
    .where(eq(pipelines.id, deal.pipelineId));
  signal.throwIfAborted();
  const pipelineGroup = pipeline?.visibilityGroupId ?? null;
  if (!canSee(actor, toVisibleDeal(deal, pipelineGroup))) {
    return err(new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId }));
  }
  return ok(undefined);
}

export async function addDealLine(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ line: DealLine; value: string | null }, AppError>> {
  const parsed = addDealLineInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput());
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const editable = await loadEditableDeal(tx, actor, input.dealId, signal);
    if (!editable.ok) return err(editable.error);
    const deal = await lockDeal(tx, input.dealId);
    if (deal === null) {
      return err(
        new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId: input.dealId }),
      );
    }

    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.active, true)));
    if (product === undefined) {
      return err(
        new AppError(ERROR_IDS.PRODUCT_NOT_FOUND, "Product not found", {
          productId: input.productId,
        }),
      );
    }

    const currency = await dealCurrency(tx, input.dealId, signal);
    let itemPrice = input.itemPrice;
    if (itemPrice === undefined) {
      if (product.currency === currency) {
        itemPrice = product.price;
      } else {
        const converted = convertPrice(
          product.price,
          product.currency,
          currency,
          await loadRateMap(tx, signal),
        );
        if ("missing" in converted) return err(rateMissing(converted.missing));
        itemPrice = converted.value;
      }
    }

    const [max] = await tx
      .select({ pos: sql<number>`coalesce(max(${dealProducts.position}), 0)` })
      .from(dealProducts)
      .where(eq(dealProducts.dealId, input.dealId));
    const [line] = await tx
      .insert(dealProducts)
      .values({
        dealId: input.dealId,
        productId: input.productId,
        position: (max?.pos ?? 0) + 1,
        quantity: input.quantity ?? "1",
        itemPrice,
        discountPercent: input.discountPercent ?? "0",
        taxPercent: input.taxPercent ?? product.taxPercent,
        comments: input.comments ?? null,
      })
      .returning();
    if (line === undefined) {
      throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "addDealLine: insert returned no rows");
    }
    const updated = await syncDealValue(tx, deal, actor.id, signal);
    return ok({ line, value: updated.value });
  });
}

export async function updateDealLine(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ line: DealLine; value: string | null }, AppError>> {
  const parsed = updateDealLineInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput());
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dealProducts)
      .where(eq(dealProducts.id, input.lineId));
    if (existing === undefined) {
      return err(
        new AppError(ERROR_IDS.PRODUCT_LINE_NOT_FOUND, "Deal line not found", {
          lineId: input.lineId,
        }),
      );
    }
    const editable = await loadEditableDeal(tx, actor, existing.dealId, signal);
    if (!editable.ok) return err(editable.error);
    const deal = await lockDeal(tx, existing.dealId);
    if (deal === null) {
      return err(
        new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId: existing.dealId }),
      );
    }

    const changes: Partial<typeof dealProducts.$inferInsert> = { updatedAt: new Date() };
    if (input.quantity !== undefined) changes.quantity = input.quantity;
    if (input.itemPrice !== undefined) changes.itemPrice = input.itemPrice;
    if (input.discountPercent !== undefined) changes.discountPercent = input.discountPercent;
    if (input.taxPercent !== undefined) changes.taxPercent = input.taxPercent;
    if (input.comments !== undefined) changes.comments = input.comments;
    const [line] = await tx
      .update(dealProducts)
      .set(changes)
      .where(eq(dealProducts.id, input.lineId))
      .returning();
    if (line === undefined) {
      throw new AppError(ERROR_IDS.DB_INVARIANT, "updateDealLine: UPDATE returned no row");
    }
    const updated = await syncDealValue(tx, deal, actor.id, signal);
    return ok({ line, value: updated.value });
  });
}

export async function removeDealLine(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ value: string | null }, AppError>> {
  const parsed = removeDealLineInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput());

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dealProducts)
      .where(eq(dealProducts.id, parsed.data.lineId));
    if (existing === undefined) {
      return err(
        new AppError(ERROR_IDS.PRODUCT_LINE_NOT_FOUND, "Deal line not found", {
          lineId: parsed.data.lineId,
        }),
      );
    }
    const editable = await loadEditableDeal(tx, actor, existing.dealId, signal);
    if (!editable.ok) return err(editable.error);
    const deal = await lockDeal(tx, existing.dealId);
    if (deal === null) {
      return err(
        new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId: existing.dealId }),
      );
    }
    await tx.delete(dealProducts).where(eq(dealProducts.id, parsed.data.lineId));
    const updated = await syncDealValue(tx, deal, actor.id, signal);
    return ok({ value: updated.value });
  });
}
