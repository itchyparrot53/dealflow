import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { DATE_PRESET_KEYS } from "@/constants/dateFilterPresets";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { labels, pipelines, stages, users } from "@/db/schema";
import { ORG_FILTER_CONFIG, PERSON_FILTER_CONFIG } from "@/features/contacts/contactFilterConfig";
import { LEAD_CONDITION_CONFIG } from "@/features/leads/leadFilterFields";
import { DEAL_CONDITION_CONFIG } from "@/features/saved-filters/filterFields";
import { savedFilterDefinitionSchema } from "@/features/saved-filters/schemas";
import type { HydratedActor } from "@/server/hydrateActor";
import { ok, type Result } from "@/types/result";
import { type ChatJsonDeps, chatJson } from "./chatJson";

const CONFIG_BY_ENTITY = {
  deal: DEAL_CONDITION_CONFIG,
  person: PERSON_FILTER_CONFIG,
  organization: ORG_FILTER_CONFIG,
  lead: LEAD_CONDITION_CONFIG,
} as const;

export const AI_FILTER_ENTITIES = ["deal", "person", "organization", "lead"] as const;
export type AiFilterEntity = (typeof AI_FILTER_ENTITIES)[number];

export const aiFilterInputSchema = z.object({
  entity: z.enum(AI_FILTER_ENTITIES),
  text: z.string().min(1).max(500),
});
export type AiFilterInput = z.infer<typeof aiFilterInputSchema>;

export interface FieldSpec {
  field: string;
  ops: readonly string[];
  kind: "number" | "date" | "labels" | "text";
}

export interface FilterReference {
  fields: FieldSpec[];
  users: { id: string; name: string }[];
  stages: { id: string; name: string }[];
  labels: string[];
  today: string;
}

export interface AiFilterResult {
  definition: unknown;
  explanation: string;
}

const PLURAL: Record<AiFilterEntity, string> = {
  deal: "deals",
  person: "people",
  organization: "organizations",
  lead: "leads",
};

// The prompt lists only fields, operators and value vocabularies the validator will accept, so a
// model cannot invent a field that then fails every attempt.
export function fieldCatalogue(entity: AiFilterEntity): FieldSpec[] {
  const config = CONFIG_BY_ENTITY[entity];
  const fields = config.fields as readonly string[];
  const opsByField = config.opsByField as Record<string, readonly string[]>;
  const numeric = config.numericFields as readonly string[];
  const array = config.arrayFields as readonly string[];
  const dateFields = "dateFields" in config ? (config.dateFields as readonly string[]) : [];
  return fields.map((field) => ({
    field,
    ops: opsByField[field] ?? [],
    kind: numeric.includes(field)
      ? "number"
      : dateFields.includes(field)
        ? "date"
        : array.includes(field)
          ? "labels"
          : "text",
  }));
}

export function filterPrompt(
  entity: AiFilterEntity,
  reference: FilterReference,
  userId: string,
): string {
  return `You are a CRM filter builder. Convert the user's request into a filter for ${PLURAL[entity]}. Reply with JSON only: {"definition": {"combinator": "and" | "or", "conditions": [{"field": string, "op": string, "value": string | number | string[]}]}, "explanation": string (max 25 words)}. Use only these fields and operators: ${JSON.stringify(reference.fields)}. Date values are one of ${DATE_PRESET_KEYS.join(", ")} or YYYY-MM-DD. Owner values are user ids from ${JSON.stringify(reference.users)}. Stage values are stage ids from ${JSON.stringify(reference.stages)}. Label values are label names from ${JSON.stringify(reference.labels)}. The current user id is ${userId}. Today is ${reference.today}. Operators isEmpty and isNotEmpty take no value.`;
}

// Wraps the real saved-filter schema so a definition that would be rejected by the board counts as
// invalid AI output (and gets the chatJson retry) together with the explanation.
function filterOutputSchema(entity: AiFilterEntity) {
  return z.object({
    definition: savedFilterDefinitionSchema(entity),
    explanation: z.string().transform((value) => value.slice(0, 200)),
  });
}

async function loadReference(
  db: Db,
  actor: HydratedActor,
  entity: AiFilterEntity,
  signal: AbortSignal,
): Promise<FilterReference> {
  const [userRows, pipelineRows, labelRows] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)),
    db
      .select({ id: pipelines.id, visibilityGroupId: pipelines.visibilityGroupId })
      .from(pipelines)
      .where(eq(pipelines.isArchived, false)),
    db.select({ name: labels.name }).from(labels).where(eq(labels.target, entity)),
  ]);
  signal.throwIfAborted();
  const visiblePipelines = pipelineRows.filter(
    (pipeline) =>
      pipeline.visibilityGroupId === null ||
      actor.type === "admin" ||
      actor.groupIds.has(pipeline.visibilityGroupId),
  );
  const stageRows =
    visiblePipelines.length === 0
      ? []
      : await db
          .select({ id: stages.id, name: stages.name })
          .from(stages)
          .where(
            and(
              inArray(
                stages.pipelineId,
                visiblePipelines.map((pipeline) => pipeline.id),
              ),
            ),
          );
  signal.throwIfAborted();
  return {
    fields: fieldCatalogue(entity),
    users: userRows,
    stages: stageRows,
    labels: labelRows.map((label) => label.name),
    today: new Date().toISOString().slice(0, 10),
  };
}

export async function describeFilter(
  db: Db,
  actor: HydratedActor,
  input: AiFilterInput,
  signal: AbortSignal,
  deps: { chat?: ChatJsonDeps; reference?: FilterReference } = {},
): Promise<Result<AiFilterResult, AppError>> {
  const reference = deps.reference ?? (await loadReference(db, actor, input.entity, signal));
  const result = await chatJson(
    db,
    actor.id,
    "ai_filter",
    {
      system: filterPrompt(input.entity, reference, actor.id),
      user: input.text,
      schema: filterOutputSchema(input.entity),
      maxTokens: 700,
    },
    signal,
    deps.chat,
  );
  if (!result.ok) return result;
  return ok({ definition: result.value.definition, explanation: result.value.explanation });
}
