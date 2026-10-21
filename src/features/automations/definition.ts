import { z } from "zod";
import { AUTOMATION_MAX_ACTIONS } from "@/constants/automations";
import type { DomainEventType } from "@/features/events/types";
import { type FilterDefinition, filterDefinition } from "@/features/saved-filters/schemas";
import { assertNever } from "@/types/result";

// The automation definition: what fires it, an optional saved-filter condition, and an ordered
// list of actions. Pure: the editor, the dispatcher's trigger match, the AI draft validator and
// the runner all read the same schema, so nothing can store a definition the runner cannot run.

export const TRIGGER_TYPES = [
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "deal.deleted",
  "deal.rotting",
  "person.created",
  "organization.created",
  "activity.created",
  "activity.completed",
  "document.sent",
  "document.viewed",
  "document.accepted",
  "document.declined",
  "invoice.overdue",
  "invoice.paid",
  // Part 6: forms and booking pages.
  "form.submitted",
  "booking.created",
  "booking.cancelled",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const DOCUMENT_KINDS = ["quote", "invoice"] as const;
const documentKind = z.enum(DOCUMENT_KINDS);

const uuid = z.string().uuid();

// A pipeline filter is optional on every deal trigger; an absent one means "any pipeline".
// The literal type must stay the specific trigger (generic), otherwise Zod's discriminated union
// widens every variant's `type` to the whole TriggerType union and narrowing fails.
const pipelineTrigger = <T extends TriggerType>(type: T) =>
  z.object({ type: z.literal(type), pipelineId: uuid.optional() });

const documentTrigger = <
  T extends
    | "document.sent"
    | "document.viewed"
    | "document.accepted"
    | "document.declined"
    | "invoice.overdue"
    | "invoice.paid",
>(
  type: T,
) => z.object({ type: z.literal(type), kind: documentKind.optional() });

export const triggerSchema = z.discriminatedUnion("type", [
  pipelineTrigger("deal.created"),
  z.object({
    type: z.literal("deal.updated"),
    pipelineId: uuid.optional(),
    // Fire only when one of these fields changed. Unset or empty means any change.
    fields: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    type: z.literal("deal.stage_changed"),
    pipelineId: uuid.optional(),
    // The stage entered, not the stage left.
    stageId: uuid.optional(),
  }),
  pipelineTrigger("deal.won"),
  pipelineTrigger("deal.lost"),
  pipelineTrigger("deal.deleted"),
  pipelineTrigger("deal.rotting"),
  z.object({ type: z.literal("person.created") }),
  z.object({ type: z.literal("organization.created") }),
  z.object({ type: z.literal("activity.created") }),
  z.object({ type: z.literal("activity.completed") }),
  documentTrigger("document.sent"),
  documentTrigger("document.viewed"),
  documentTrigger("document.accepted"),
  documentTrigger("document.declined"),
  documentTrigger("invoice.overdue"),
  documentTrigger("invoice.paid"),
  // One form or every form; the picker offers a form id.
  z.object({ type: z.literal("form.submitted"), formId: uuid.optional() }),
  z.object({ type: z.literal("booking.created") }),
  z.object({ type: z.literal("booking.cancelled") }),
]);

export type Trigger = z.infer<typeof triggerSchema>;

export const ACTION_TYPES = [
  "update_deal",
  "create_activity",
  "add_note",
  "notify_user",
  "send_email",
  "ai_summarize_deal",
  "ai_score_deal",
  "ai_draft_email",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

const updateDealSet = z
  .object({
    stageId: uuid.optional(),
    ownerId: uuid.optional(),
    status: z.enum(["won", "lost"]).optional(),
    lostReasonId: uuid.optional(),
    expectedCloseInDays: z.number().int().min(0).max(3650).optional(),
  })
  .refine(
    (set) =>
      set.stageId !== undefined ||
      set.ownerId !== undefined ||
      set.status !== undefined ||
      set.lostReasonId !== undefined ||
      set.expectedCloseInDays !== undefined,
    { message: "update_deal needs at least one field to set" },
  );

const assignee = z.union([z.enum(["deal_owner", "automation_owner"]), z.object({ userId: uuid })]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update_deal"), set: updateDealSet }),
  z.object({
    type: z.literal("create_activity"),
    activityTypeId: uuid,
    // Variables such as {{person.name}} are rendered by the runner.
    subject: z.string().min(1).max(200),
    dueInDays: z.number().int().min(0).max(365),
    assignee,
  }),
  z.object({ type: z.literal("add_note"), body: z.string().min(1).max(5000) }),
  z.object({
    type: z.literal("notify_user"),
    // 6.7 lists deal_owner; template 6 in 6.9 needs the automation owner, so both are offered.
    to: z.union([z.enum(["deal_owner", "automation_owner"]), z.object({ userId: uuid })]),
    message: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal("send_email"),
    templateId: uuid,
    // Only the deal's primary person; there is no free-text recipient in this part.
    to: z.literal("deal_person"),
  }),
  z.object({ type: z.literal("ai_summarize_deal") }),
  z.object({ type: z.literal("ai_score_deal") }),
  z.object({
    type: z.literal("ai_draft_email"),
    instructions: z.string().min(1).max(1000),
  }),
]);

export type Action = z.infer<typeof actionSchema>;

export const automationDefinitionSchema: z.ZodType<AutomationDefinition> = z.object({
  trigger: triggerSchema,
  condition: filterDefinition.nullable(),
  actions: z.array(actionSchema).min(1).max(AUTOMATION_MAX_ACTIONS),
});

export type AutomationDefinition = {
  trigger: Trigger;
  condition: FilterDefinition | null;
  actions: Action[];
};

export interface TriggerEvent {
  type: DomainEventType;
  changes: { field: string }[];
  pipelineId: string | null;
  stageId: string | null;
  documentKind: (typeof DOCUMENT_KINDS)[number] | null;
  // A form submission's form. Read from the event's changes by the dispatcher.
  formId: string | null;
}

function matchesPipeline(filter: string | undefined, actual: string | null): boolean {
  return filter === undefined || filter === actual;
}

export function matchesTrigger(trigger: Trigger, event: TriggerEvent): boolean {
  if (trigger.type !== event.type) return false;

  switch (trigger.type) {
    case "deal.created":
    case "deal.won":
    case "deal.lost":
    case "deal.deleted":
    case "deal.rotting":
      return matchesPipeline(trigger.pipelineId, event.pipelineId);
    case "deal.updated": {
      if (!matchesPipeline(trigger.pipelineId, event.pipelineId)) return false;
      if (trigger.fields === undefined || trigger.fields.length === 0) return true;
      return trigger.fields.some((field) => event.changes.some((change) => change.field === field));
    }
    case "deal.stage_changed": {
      if (!matchesPipeline(trigger.pipelineId, event.pipelineId)) return false;
      return trigger.stageId === undefined || trigger.stageId === event.stageId;
    }
    case "person.created":
    case "organization.created":
    case "activity.created":
    case "activity.completed":
      return true;
    case "document.sent":
    case "document.viewed":
    case "document.accepted":
    case "document.declined":
    case "invoice.overdue":
    case "invoice.paid":
      return trigger.kind === undefined || trigger.kind === event.documentKind;
    case "form.submitted":
      return trigger.formId === undefined || trigger.formId === event.formId;
    case "booking.created":
    case "booking.cancelled":
      return true;
    default:
      return assertNever(trigger);
  }
}

// Conditions run against the record the event is about. Document and invoice events take their
// condition on the related deal, so a deal that is gone skips the run as condition_false.
export function conditionTarget(event: {
  type: DomainEventType;
}): "deal" | "person" | "organization" {
  switch (event.type) {
    case "person.created":
    case "person.updated":
      return "person";
    case "organization.created":
    case "organization.updated":
      return "organization";
    case "deal.created":
    case "deal.updated":
    case "deal.stage_changed":
    case "deal.won":
    case "deal.lost":
    case "deal.deleted":
    case "deal.rotting":
    case "activity.created":
    case "activity.completed":
    case "document.sent":
    case "document.viewed":
    case "document.accepted":
    case "document.declined":
    case "invoice.overdue":
    case "invoice.paid":
    case "invoice.voided":
      return "deal";
    // Forms and bookings run their condition against the visitor's person (6.8).
    case "form.submitted":
    case "booking.created":
    case "booking.cancelled":
      return "person";
  }
}
