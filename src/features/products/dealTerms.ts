import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { BOARD_EVENT, dealChannel } from "@/constants/boardChannels";
import { CHANGE_FIELD_CURRENCY, CHANGE_FIELD_PROBABILITY } from "@/constants/changeLogFields";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { deals } from "@/db/schema/deals";
import { dealProducts, dealTerms, stageProbabilities } from "@/db/schema/sales";
import { stages } from "@/db/schema/stages";
import { recordChange } from "@/features/collaboration/changeLog";
import { readBaseCurrency } from "@/features/currency/rates";
import { isSupportedCurrency } from "@/features/currency/schemas";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { publishBoardEvent } from "@/server/realtime/events";
import { err, ok, type Result } from "@/types/result";
import { assertDealVisible } from "./dealProducts";

// Deal terms: the deal's currency and optional probability override, plus the
// per-stage default probability. A deal with no deal_terms row is in the base
// currency with no override. Effective probability = override, then stage, then 100.

export interface DealTermsView {
  currency: string;
  probability: number | null;
  stageProbability: number | null;
  effectiveProbability: number;
}

const DEFAULT_PROBABILITY = 100;

export const dealTermsInput = z.object({
  dealId: z.string().uuid(),
  currency: z.string().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
});

export const stageProbabilityInput = z.object({
  stageId: z.string().uuid(),
  probability: z.number().int().min(0).max(100),
});

function invalidInput(): AppError {
  return new AppError(ERROR_IDS.PRODUCT_INPUT_INVALID, "Deal terms input failed validation");
}

interface TermsRow {
  currency: string;
  probability: number | null;
}

async function termsFor(db: DbOrTx, dealId: string, signal: AbortSignal): Promise<TermsRow> {
  const [row] = await db
    .select({ currency: dealTerms.currency, probability: dealTerms.probability })
    .from(dealTerms)
    .where(eq(dealTerms.dealId, dealId));
  signal.throwIfAborted();
  return {
    currency: row?.currency ?? (await readBaseCurrency(db, signal)),
    probability: row?.probability ?? null,
  };
}

async function stageProbabilityFor(
  db: DbOrTx,
  stageId: string,
  signal: AbortSignal,
): Promise<number | null> {
  const [row] = await db
    .select({ probability: stageProbabilities.probability })
    .from(stageProbabilities)
    .where(eq(stageProbabilities.stageId, stageId));
  signal.throwIfAborted();
  return row?.probability ?? null;
}

export async function getDealTerms(
  db: DbOrTx,
  actor: PermSetUser,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<DealTermsView, AppError>> {
  const visible = await assertDealVisible(db, actor, dealId, signal);
  if (!visible.ok) return visible;
  const [deal] = await db
    .select({ stageId: deals.stageId })
    .from(deals)
    .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)));
  if (deal === undefined) {
    return err(new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId }));
  }
  const terms = await termsFor(db, dealId, signal);
  const stageProbability = await stageProbabilityFor(db, deal.stageId, signal);
  return ok({
    currency: terms.currency,
    probability: terms.probability,
    stageProbability,
    effectiveProbability: terms.probability ?? stageProbability ?? DEFAULT_PROBABILITY,
  });
}

export async function setDealTerms(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<DealTermsView, AppError>> {
  const parsed = dealTermsInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput());
  const input = parsed.data;
  if (input.currency !== undefined && !isSupportedCurrency(input.currency)) {
    return err(new AppError(ERROR_IDS.CURRENCY_UNKNOWN, "Unknown currency code"));
  }

  return db.transaction(async (tx) => {
    const editable = await loadEditableDeal(tx, actor, input.dealId, signal);
    if (!editable.ok) return err(editable.error);
    const [deal] = await tx.select().from(deals).where(eq(deals.id, input.dealId)).for("update");
    if (deal === undefined) {
      return err(
        new AppError(ERROR_IDS.DEAL_NOT_FOUND, "Deal not found", { dealId: input.dealId }),
      );
    }
    const current = await termsFor(tx, input.dealId, signal);
    const next: TermsRow = {
      currency: input.currency ?? current.currency,
      probability: input.probability === undefined ? current.probability : input.probability,
    };

    if (next.currency !== current.currency) {
      const [line] = await tx
        .select({ id: dealProducts.id })
        .from(dealProducts)
        .where(eq(dealProducts.dealId, input.dealId))
        .limit(1);
      if (line !== undefined) {
        return err(
          new AppError(
            ERROR_IDS.CURRENCY_CHANGE_WITH_LINES,
            "Remove the products before changing the currency",
            { dealId: input.dealId },
          ),
        );
      }
    }
    if (next.currency === current.currency && next.probability === current.probability) {
      return getDealTerms(tx, actor, input.dealId, signal);
    }

    const now = new Date();
    await tx
      .insert(dealTerms)
      .values({
        dealId: input.dealId,
        currency: next.currency,
        probability: next.probability,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: dealTerms.dealId,
        set: { currency: next.currency, probability: next.probability, updatedAt: now },
      });

    if (next.currency !== current.currency) {
      await recordChange(
        tx,
        {
          entityType: "deal",
          entityId: input.dealId,
          field: CHANGE_FIELD_CURRENCY,
          oldValue: current.currency,
          newValue: next.currency,
          actorId: actor.id,
        },
        signal,
      );
    }
    if (next.probability !== current.probability) {
      await recordChange(
        tx,
        {
          entityType: "deal",
          entityId: input.dealId,
          field: CHANGE_FIELD_PROBABILITY,
          oldValue: current.probability,
          newValue: next.probability,
          actorId: actor.id,
        },
        signal,
      );
    }
    await publishBoardEvent(
      tx,
      {
        channel: dealChannel(input.dealId),
        type: BOARD_EVENT.dealUpdated,
        actorId: actor.id,
        data: { dealId: input.dealId },
      },
      signal,
    );
    return getDealTerms(tx, actor, input.dealId, signal);
  });
}

export async function setStageProbability(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ stageId: string; probability: number }, AppError>> {
  if (!can(actor, "pipeline.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "pipeline.manage required", { userId: actor.id }),
    );
  }
  const parsed = stageProbabilityInput.safeParse(raw);
  if (!parsed.success) return err(invalidInput());
  signal.throwIfAborted();

  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.id, parsed.data.stageId));
  if (stage === undefined) {
    return err(
      new AppError(ERROR_IDS.STAGE_NOT_FOUND, "Stage not found", { stageId: parsed.data.stageId }),
    );
  }
  const [row] = await db
    .insert(stageProbabilities)
    .values({ stageId: parsed.data.stageId, probability: parsed.data.probability })
    .onConflictDoUpdate({
      target: stageProbabilities.stageId,
      set: { probability: parsed.data.probability },
    })
    .returning();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "setStageProbability: no rows");
  }
  return ok({ stageId: row.stageId, probability: row.probability });
}
