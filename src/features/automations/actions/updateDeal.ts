import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { changeOwner } from "@/features/deal-workspace/changeOwner";
import { changeStage } from "@/features/deal-workspace/changeStage";
import { markLost, markWon } from "@/features/deal-workspace/wonLost";
import { updateDeal } from "@/features/deals/dealUpdate";
import { registerActionHandler } from "./registry";
import { loadDealRow } from "./context";
import type { StepResult } from "../runner";

// update_deal calls the same services the deal page calls, so permissions, change logs, board
// events and the CAS preconditions all behave exactly as for a user edit.

function failed(errorId: string, detail: string): StepResult {
  return { ok: false, errorId, detail };
}

function dateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resultError(result: { ok: boolean; error?: AppError }): StepResult | null {
  return result.ok ? null : failed(result.error?.id ?? ERROR_IDS.AUTOMATION_ACTION_FAILED, "service refused");
}

registerActionHandler("update_deal", async (ctx, action) => {
  if (action.type !== "update_deal") return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "wrong action");
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");

  const { set } = action;
  // Each service re-reads the deal, so the CAS timestamp stays current between steps.
  if (set.expectedCloseInDays !== undefined) {
    const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
    if (deal === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "deal missing");
    const result = await updateDeal(
      ctx.db,
      ctx.actor,
      {
        dealId: ctx.dealId,
        expectedUpdatedAt: deal.updatedAt.toISOString(),
        expectedCloseDate: dateInDays(set.expectedCloseInDays),
      },
      ctx.signal,
    );
    const error = resultError(result);
    if (error !== null) return error;
  }

  if (set.stageId !== undefined) {
    const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
    if (deal === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "deal missing");
    const result = await changeStage(
      ctx.db,
      ctx.actor,
      {
        dealId: ctx.dealId,
        toStageId: set.stageId,
        expectedUpdatedAt: deal.updatedAt.toISOString(),
      },
      ctx.signal,
    );
    const error = resultError(result);
    if (error !== null) return error;
  }

  if (set.ownerId !== undefined) {
    const result = await changeOwner(
      ctx.db,
      ctx.actor,
      { dealId: ctx.dealId, ownerId: set.ownerId },
      ctx.signal,
    );
    const error = resultError(result);
    if (error !== null) return error;
  }

  if (set.status === "won") {
    const result = await markWon(ctx.db, ctx.actor, ctx.dealId, ctx.signal);
    const error = resultError(result);
    if (error !== null) return error;
  }
  if (set.status === "lost") {
    const result = await markLost(
      ctx.db,
      ctx.actor,
      ctx.dealId,
      { lostReasonId: set.lostReasonId ?? null, lostReason: null },
      ctx.signal,
    );
    const error = resultError(result);
    if (error !== null) return error;
  }

  return { ok: true, detail: "deal updated" };
});
