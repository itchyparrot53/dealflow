import { eq } from "drizzle-orm";
import { ERROR_IDS } from "@/constants/errorIds";
import { persons } from "@/db/schema";
import { scoreDeal, summarizeDeal } from "@/features/ai/dealInsights";
import { draftEmail } from "@/features/ai/emailDraft";
import { createNote } from "@/features/collaboration/notesRepo";
import { saveDraft } from "@/features/email/draftRepo";
import { getActorMailboxStatus } from "@/features/email/mailboxOwnership";
import { hydrateActor } from "@/server/hydrateActor";
import { loadDealRow } from "./context";
import { registerActionHandler } from "./registry";
import type { ActionContext, StepResult } from "../runner";

// AI actions call Part 1's functions with the automation's creator as the actor, so the same
// provider selection, company and user caps, rate limit and usage rows apply as for a manual call.

function failed(errorId: string, detail: string): StepResult {
  return { ok: false, errorId, detail };
}

async function actorFor(ctx: ActionContext) {
  return hydrateActor(ctx.db, ctx.actor.id, ctx.signal);
}

registerActionHandler("ai_summarize_deal", async (ctx) => {
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  const actor = await actorFor(ctx);
  if (actor === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "actor inactive");

  const result = await summarizeDeal(ctx.db, actor, ctx.dealId, ctx.signal);
  if (!result.ok) return failed(result.error.id, "AI summary failed");
  const data = result.value.summary;
  if (data === null || data.summary.trim() === "") {
    return failed(ERROR_IDS.AI_BAD_OUTPUT, "empty summary");
  }
  const lines = [data.summary];
  if (data.risks.length > 0) lines.push("", "Risks:", ...data.risks.map((risk) => `- ${risk}`));
  if (data.nextSteps.length > 0) {
    lines.push("", "Next steps:", ...data.nextSteps.map((step) => `- ${step.subject}`));
  }
  const body = lines.join("\n").slice(0, 5000);

  const note = await createNote(
    ctx.db,
    actor,
    { entityType: "deal", entityId: ctx.dealId, body, pinned: false },
    ctx.signal,
  );
  if (!note.ok) return failed(note.error.id, "note write failed");
  return { ok: true, detail: `note ${note.value.id}` };
});

registerActionHandler("ai_score_deal", async (ctx) => {
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  const actor = await actorFor(ctx);
  if (actor === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "actor inactive");

  const result = await scoreDeal(ctx.db, actor, ctx.dealId, ctx.signal);
  if (!result.ok) return failed(result.error.id, "AI score failed");
  return { ok: true, detail: `score ${result.value.score ?? ""}` };
});

registerActionHandler("ai_draft_email", async (ctx, action) => {
  if (action.type !== "ai_draft_email") {
    return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "wrong action");
  }
  if (ctx.dealId === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "no related deal");
  const actor = await actorFor(ctx);
  if (actor === null) return failed(ERROR_IDS.AUTOMATION_ACTION_FAILED, "actor inactive");

  const deal = await loadDealRow(ctx.db, ctx.dealId, ctx.signal);
  if (deal === null || deal.personId === null) {
    return failed(ERROR_IDS.AUTOMATION_EMAIL_SKIPPED, "no person on the deal");
  }
  const [person] = await ctx.db
    .select({ id: persons.id, email: persons.primaryEmail })
    .from(persons)
    .where(eq(persons.id, deal.personId));
  if (person?.email == null || person.email === "") {
    return failed(ERROR_IDS.AUTOMATION_EMAIL_SKIPPED, "person has no email");
  }
  const mailbox = await getActorMailboxStatus(ctx.db, ctx.actor.id, ctx.signal);
  if (mailbox === null || mailbox.status !== "connected") {
    return failed(ERROR_IDS.AUTOMATION_EMAIL_SKIPPED, "no connected mailbox");
  }

  const draft = await draftEmail(
    ctx.db,
    actor,
    {
      instruction: action.instructions.slice(0, 500),
      tone: "friendly",
      dealId: ctx.dealId,
      personId: person.id,
      recipientEmail: person.email,
    },
    ctx.signal,
  );
  if (!draft.ok) return failed(draft.error.id, "AI draft failed");

  // Saved, never sent: the deal owner reviews and sends it from the composer.
  const saved = await saveDraft(
    ctx.db,
    {
      actor,
      draft: {
        accountId: mailbox.id,
        subject: draft.value.subject,
        bodyHtml: draft.value.bodyHtml,
        toEmails: [person.email],
        ccEmails: [],
        linkDealId: ctx.dealId,
        linkPersonId: person.id,
      },
    },
    ctx.signal,
  );
  if (!saved.ok) return failed(saved.error.id, "draft save failed");
  return { ok: true, detail: `draft ${saved.value.id}` };
});
