import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { activityTypes, emailTemplates, pipelines, stages, users } from "@/db/schema";
import { chatJson } from "@/features/ai/chatJson";
import { checkAiRateLimit } from "@/features/ai/rateLimit";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import {
  ACTION_TYPES,
  type AutomationDefinition,
  automationDefinitionSchema,
  TRIGGER_TYPES,
} from "./definition";

// "Describe it": one AI call turns a sentence into a draft definition. The model gets the
// install's real pipeline, stage, activity-type, template and user ids, and the result is parsed
// with the same schema the editor saves, so an unparsable answer cannot reach the database.

export const describeInput = z.object({ text: z.string().trim().min(1).max(2000) });

const AI_ACTION_TYPES = ACTION_TYPES.filter((type) => type !== "enroll_in_sequence");

const SYSTEM_PROMPT = `You are the Dealflow automation builder. Turn the user's sentence into one automation definition.
Return ONLY JSON with this shape: {"trigger": {...}, "condition": null, "actions": [...]}.
Allowed trigger types: ${TRIGGER_TYPES.join(", ")}.
Allowed action types: ${AI_ACTION_TYPES.join(", ")}.
A trigger may carry pipelineId, stageId (the stage entered), kind ("quote" or "invoice") or fields (an array of deal field names).
Actions: update_deal {set: {stageId?, ownerId?, status?: "won"|"lost", lostReasonId?, expectedCloseInDays?}},
create_activity {activityTypeId, subject, dueInDays, assignee: "deal_owner"|"automation_owner"|{userId}},
add_note {body}, notify_user {to: "deal_owner"|{userId}, message}, send_email {templateId, to: "deal_person"},
ai_summarize_deal, ai_score_deal, ai_draft_email {instructions},
create_project {phases?: string[] (each 1..80, at most 10), nameTemplate?: string}.
Every id MUST come from the lists in the user message; never invent one. Use {{deal.title}},
{{person.name}}, {{organization.name}} and {{owner.name}} in text fields. At most 10 actions.
If the request cannot be expressed, return JSON that matches the shape as closely as possible.`;

interface DraftLookups {
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string }[];
  activityTypes: { id: string; name: string }[];
  emailTemplates: { id: string; name: string }[];
  users: { id: string; name: string }[];
}

async function loadLookups(db: Db, actor: PermSetUser, signal: AbortSignal): Promise<DraftLookups> {
  signal.throwIfAborted();
  const pipelineRows = await db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines);
  const stageRows = await db
    .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
    .from(stages);
  const typeRows = await db
    .select({ id: activityTypes.id, name: activityTypes.name })
    .from(activityTypes)
    .where(isNull(activityTypes.archivedAt));
  const templateRows = await db
    .select({ id: emailTemplates.id, name: emailTemplates.name })
    .from(emailTemplates)
    .where(eq(emailTemplates.ownerId, actor.id));
  const userRows = await db.select({ id: users.id, name: users.name }).from(users);
  return {
    pipelines: pipelineRows,
    stages: stageRows,
    activityTypes: typeRows,
    emailTemplates: templateRows,
    users: userRows,
  };
}

export async function draftAutomation(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<AutomationDefinition, AppError>> {
  if (!can(actor, "automations.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "automations.manage required", { userId: actor.id }),
    );
  }
  const parsed = describeInput.safeParse(raw);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.AUTOMATION_INPUT_INVALID, "describe input invalid", {
        issues: parsed.error.issues,
      }),
    );
  }

  if (!checkAiRateLimit(actor.id)) {
    return err(
      new AppError(ERROR_IDS.AI_RATE_LIMITED, "AI rate limit reached", { userId: actor.id }),
    );
  }

  const lookups = await loadLookups(db, actor, signal);
  const user = JSON.stringify({ request: parsed.data.text, ...lookups });
  const result = await chatJson(
    db,
    actor.id,
    "automation_describe",
    { system: SYSTEM_PROMPT, user, schema: automationDefinitionSchema, maxTokens: 900 },
    signal,
  );
  if (result.ok) return ok(result.value);
  // chatJson already retried once with the validation issues; a second failure is final.
  if (result.error.id === ERROR_IDS.AI_BAD_OUTPUT) {
    return err(
      new AppError(ERROR_IDS.AUTOMATION_DRAFT_INVALID, "AI draft could not be parsed", {
        cause: result.error.id,
      }),
    );
  }
  return result;
}
