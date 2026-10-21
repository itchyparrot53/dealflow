import { eq } from "drizzle-orm";
import { ERROR_IDS } from "@/constants/errorIds";
import { users } from "@/db/schema";
import { renderVariables } from "@/features/documents/variables";
import { createNotification } from "@/features/notifications/produce";
import { loadDealRow, loadVariableContext } from "./context";
import { registerActionHandler } from "./registry";

// notify_user creates an in-app `automation` notification. The deal is the visibility parent, so
// the recipient gate uses the shared deal predicate; the payload carries the message.

registerActionHandler("notify_user", async (ctx, action) => {
  if (action.type !== "notify_user") {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "wrong action" };
  }
  if (ctx.dealId === null) {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "no related deal" };
  }
  const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
  if (deal === null) {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: "deal missing" };
  }

  let recipientId: string;
  if (action.to === "deal_owner") {
    recipientId = deal.ownerId;
  } else {
    const [user] = await ctx.db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, action.to.userId));
    if (user === undefined || !user.isActive) {
      return {
        ok: false,
        errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED,
        detail: "recipient missing",
      };
    }
    recipientId = user.id;
  }

  const variables = await loadVariableContext(ctx.db, ctx.dealId, ctx.signal);
  const message = renderVariables(action.message, variables).slice(0, 500);

  const result = await createNotification(
    ctx.db,
    {
      recipientId,
      type: "automation",
      entityType: "deal",
      entityId: ctx.dealId,
      actorId: ctx.actor.id,
      payload: { message, automationId: ctx.automationId },
    },
    ctx.signal,
  );
  if (!result.ok) {
    return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED, detail: result.error.id };
  }
  return {
    ok: true,
    detail:
      "notificationId" in result.value
        ? `notification ${result.value.notificationId}`
        : "notification suppressed",
  };
});
