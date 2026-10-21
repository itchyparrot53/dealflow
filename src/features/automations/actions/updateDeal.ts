import { type AppError, ERROR_IDS } from "@/constants/errorIds";
import { changeOwner } from "@/features/deal-workspace/changeOwner";
import { changeStage } from "@/features/deal-workspace/changeStage";
import { markLost, markWon } from "@/features/deal-workspace/wonLost";
import { updateDeal } from "@/features/deals/dealUpdate";
import type { Action } from "../definition";
import type { StepResult } from "../runner";
import { loadDealRow } from "./context";
import { registerActionHandler } from "./registry";

// update_deal calls the same services the deal page calls, so permissions, change logs, board
// events and the CAS preconditions all behave exactly as for a user edit.

function failed(errorId: string, detail: string): StepResult {
  return { ok: false, errorId, detail };
}

function dateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resultError(result: { ok: boolean; error?: AppError }): StepResult | null {
  return result.ok
    ? null
    : failed(result.error?.id ?? ERROR_IDS.AUTOMATION_ACTION_FAILED, "service refused");
}

type Ctx = Parameters<Parameters<typeof registerActionHandler>[1]>[0];
type UpdateSet = Extract<Action, { type: "update_deal" }>["set"];

async function applyCloseDate(ctx: Ctx, days: number): Promise<StepResult | null> {
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
  if (deal === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "deal missing");
  const result = await updateDeal(
    ctx.db,
    ctx.actor,
    {
      dealId: ctx.dealId,
      expectedUpdatedAt: deal.updatedAt.toISOString(),
      expectedCloseDate: dateInDays(days),
    },
    ctx.signal,
  );
  return resultError(result);
}

async function applyStage(ctx: Ctx, stageId: string): Promise<StepResult | null> {
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
  if (deal === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "deal missing");
  const result = await changeStage(
    ctx.db,
    ctx.actor,
    { dealId: ctx.dealId, toStageId: stageId, expectedUpdatedAt: deal.updatedAt.toISOString() },
    ctx.signal,
  );
  return resultError(result);
}

async function applyOwner(ctx: Ctx, ownerId: string): Promise<StepResult | null> {
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  const result = await changeOwner(ctx.db, ctx.actor, { dealId: ctx.dealId, ownerId }, ctx.signal);
  return resultError(result);
}

async function applyStatus(ctx: Ctx, set: UpdateSet): Promise<StepResult | null> {
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  if (set.status === "won") {
    return resultError(await markWon(ctx.db, ctx.actor, ctx.dealId, ctx.signal));
  }
  if (set.status === "lost") {
    return resultError(
      await markLost(
        ctx.db,
        ctx.actor,
        ctx.dealId,
        { lostReasonId: set.lostReasonId ?? null, lostReason: null },
        ctx.signal,
      ),
    );
  }
  return null;
}

function buildSteps(ctx: Ctx, set: UpdateSet): (() => Promise<StepResult | null>)[] {
  const steps: (() => Promise<StepResult | null>)[] = [];
  const { expectedCloseInDays, stageId, ownerId } = set;
  if (expectedCloseInDays !== undefined) steps.push(() => applyCloseDate(ctx, expectedCloseInDays));
  if (stageId !== undefined) steps.push(() => applyStage(ctx, stageId));
  if (ownerId !== undefined) steps.push(() => applyOwner(ctx, ownerId));
  if (set.status !== undefined) steps.push(() => applyStatus(ctx, set));
  return steps;
}

registerActionHandler("update_deal", async (ctx, action) => {
  if (action.type !== "update_deal") {
    return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "wrong action");
  }
  if (ctx.dealId === null) {
    return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  }
  for (const step of buildSteps(ctx, action.set)) {
    const error = await step();
    if (error !== null) return error;
  }
  return { ok: true, detail: "deal updated" };
});
