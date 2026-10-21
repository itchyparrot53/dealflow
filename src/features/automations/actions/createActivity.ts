import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { users } from "@/db/schema";
import { createActivity } from "@/features/activities/repo";
import { renderVariables } from "@/features/documents/variables";
import { loadDealRow, loadVariableContext } from "./context";
import { registerActionHandler } from "./registry";

// create_activity calls the activities service, so the activity appears on the deal timeline with
// the same validation, visibility checks, board-event updates and reminders as a user-created one.

function failed(detail: string): { ok: false; errorId: string; detail: string } {
  return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail };
}

registerActionHandler("create_activity", async (ctx, action) => {
  if (action.type !== "create_activity") return failed("wrong action");
  if (ctx.dealId === null) return failed("no related deal");

  const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
  if (deal === null) return failed("deal missing");

  let assigneeId: string;
  if (action.assignee === "automation_owner") {
    assigneeId = ctx.actor.id;
  } else if (action.assignee === "deal_owner") {
    assigneeId = deal.ownerId;
  } else {
    const [user] = await ctx.db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, action.assignee.userId));
    if (user === undefined || !user.isActive) return failed("assignee missing or inactive");
    assigneeId = user.id;
  }

  const variables = await loadVariableContext(ctx.db, ctx.dealId, ctx.signal);
  const subject = renderVariables(action.subject, variables).slice(0, 255);
  if (subject.trim() === "") return failed("subject rendered empty");

  const dueAt = new Date(Date.now() + action.dueInDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await createActivity(
    ctx.db,
    ctx.actor,
    {
      typeId: action.activityTypeId,
      subject,
      dueAt,
      dealId: ctx.dealId,
      personId: deal.personId,
      orgId: deal.orgId,
      assigneeId,
    },
    ctx.signal,
  );
  if (!result.ok) {
    return failed(result.error instanceof AppError ? result.error.id : "activity refused");
  }
  return { ok: true, detail: `activity ${result.value.id}` };
});
