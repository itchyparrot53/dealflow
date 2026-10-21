import { asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { activityTypes, pipelines, stages } from "@/db/schema";
import type { AutomationDefinition } from "./definition";

// The six built-in templates. Each builds its definition from the install's first pipeline and
// activity type, so it is valid on any database rather than hard-coding someone else's ids.

export interface TemplateContext {
  pipelineId: string;
  firstStageId: string;
  secondStageId: string;
  lastStageId: string;
  activityTypeId: string;
}

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  build: (ctx: TemplateContext) => AutomationDefinition;
}

export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
  {
    key: "onboarding-call",
    name: "Onboarding call when a deal is won",
    description: "Create an onboarding call two days after a deal is won.",
    build: (ctx) => ({
      trigger: { type: "deal.won" },
      condition: null,
      actions: [
        {
          type: "create_activity",
          activityTypeId: ctx.activityTypeId,
          subject: "Onboarding call with {{person.name}}",
          dueInDays: 2,
          assignee: "deal_owner",
        },
      ],
    }),
  },
  {
    key: "quote-accepted-notify",
    name: "Tell the owner when a quote is accepted",
    description: "Notify the deal owner as soon as a quote is accepted.",
    build: () => ({
      trigger: { type: "document.accepted" },
      condition: null,
      actions: [
        {
          type: "notify_user",
          to: "deal_owner",
          message: "A quote was accepted for {{deal.title}}",
        },
      ],
    }),
  },
  {
    key: "chase-overdue",
    name: "Chase overdue invoices",
    description: "Create a task when an invoice becomes overdue.",
    build: (ctx) => ({
      trigger: { type: "invoice.overdue" },
      condition: null,
      actions: [
        {
          type: "create_activity",
          activityTypeId: ctx.activityTypeId,
          subject: "Chase invoice for {{organization.name}}",
          dueInDays: 0,
          assignee: "deal_owner",
        },
      ],
    }),
  },
  {
    key: "advance-on-quote",
    name: "Move to the next stage when a quote is sent",
    description: "Advance a deal one stage when a quote is sent.",
    build: (ctx) => ({
      trigger: { type: "document.sent", kind: "quote" },
      condition: null,
      actions: [{ type: "update_deal", set: { stageId: ctx.secondStageId } }],
    }),
  },
  {
    key: "summarize-big-deals",
    name: "Summarize big deals when they reach the last stage",
    description: "Write an AI summary for deals worth more than 10,000 in the last stage.",
    build: (ctx) => ({
      trigger: { type: "deal.stage_changed", pipelineId: ctx.pipelineId, stageId: ctx.lastStageId },
      condition: { combinator: "and", conditions: [{ field: "value", op: "gt", value: 10_000 }] },
      actions: [{ type: "ai_summarize_deal" }],
    }),
  },
  {
    key: "welcome-org",
    name: "Welcome note for new organizations",
    description: "Notify the automation owner when an organization is created.",
    build: () => ({
      trigger: { type: "organization.created" },
      condition: null,
      actions: [
        {
          type: "notify_user",
          to: "automation_owner",
          message: "New organization: {{organization.name}}",
        },
      ],
    }),
  },
] as const;

export async function buildTemplateContext(
  db: Db,
  signal: AbortSignal,
): Promise<TemplateContext | null> {
  signal.throwIfAborted();
  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .orderBy(asc(pipelines.createdAt))
    .limit(1);
  if (pipeline === undefined) return null;
  const stageRows = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.pipelineId, pipeline.id))
    .orderBy(asc(stages.order));
  const [activityType] = await db
    .select({ id: activityTypes.id })
    .from(activityTypes)
    .where(isNull(activityTypes.archivedAt))
    .orderBy(asc(activityTypes.order))
    .limit(1);
  const first = stageRows[0]?.id;
  const second = stageRows[1]?.id;
  const last = stageRows[stageRows.length - 1]?.id;
  if (first === undefined || last === undefined || activityType === undefined) return null;
  return {
    pipelineId: pipeline.id,
    firstStageId: first,
    secondStageId: second ?? first,
    lastStageId: last,
    activityTypeId: activityType.id,
  };
}
