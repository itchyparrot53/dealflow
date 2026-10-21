import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  deals,
  leads,
  persons,
  pipelines,
  stages,
  users,
  webFormSubmissions,
  webForms,
} from "@/db/schema";
import { listDefs } from "@/features/custom-fields/defsRepo";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import type { CustomFieldDef } from "@/types/customFields";
import { err, ok, type Result } from "@/types/result";
import {
  ALLOWED_CUSTOM_FIELD_TYPES,
  type FormField,
  type FormFieldKey,
  formFieldsSchema,
} from "./fields";

// Web-form CRUD. Every mutation is admin-only through `forms.manage`; the public read and submit
// paths live in submit.ts and never take an actor.

export type WebForm = typeof webForms.$inferSelect;
export type WebFormSubmissionRow = typeof webFormSubmissions.$inferSelect;

const nameSchema = z.string().trim().min(1).max(120);
const titleSchema = z.string().trim().min(1).max(150);
const descriptionSchema = z.string().trim().max(1000).nullable().optional();
const successMessageSchema = z.string().trim().min(1).max(1000).optional();
const redirectSchema = z.string().trim().max(2000).nullable().optional();
const idSchema = z.string().uuid();

export const formInputSchema = z.object({
  name: nameSchema,
  title: titleSchema,
  description: descriptionSchema,
  fields: formFieldsSchema,
  creates: z.enum(["lead", "deal"]),
  pipelineId: idSchema.nullable().optional(),
  stageId: idSchema.nullable().optional(),
  ownerId: idSchema,
  successMessage: successMessageSchema,
  redirectUrl: redirectSchema,
  active: z.boolean().optional(),
});

export const formPatchSchema = formInputSchema.partial();

function denied(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "forms.manage required", { userId: actor.id });
}

function invalid(issues: unknown): AppError {
  return new AppError(ERROR_IDS.FORM_INPUT_INVALID, "form input invalid", { issues });
}

function definitionInvalid(issues: unknown): AppError {
  return new AppError(ERROR_IDS.FORM_DEFINITION_INVALID, "form definition invalid", { issues });
}

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.FORM_NOT_FOUND, "Form not found", { formId: id });
}

export function canManageForms(actor: PermSetUser): boolean {
  return can(actor, "forms.manage");
}

export function newPublicId(): string {
  return randomBytes(12).toString("base64url");
}

export async function listForms(db: DbOrTx, signal: AbortSignal): Promise<WebForm[]> {
  signal.throwIfAborted();
  return db.select().from(webForms).orderBy(desc(webForms.updatedAt));
}

export async function getForm(
  db: DbOrTx,
  id: string,
  signal: AbortSignal,
): Promise<WebForm | null> {
  signal.throwIfAborted();
  const [row] = await db.select().from(webForms).where(eq(webForms.id, id));
  return row ?? null;
}

/** Active custom field definitions a form may reference, across person, lead and deal. */
export async function listEligibleCustomFields(
  db: Db,
  signal: AbortSignal,
): Promise<CustomFieldDef[]> {
  signal.throwIfAborted();
  const groups = await Promise.all([
    listDefs(db, "person", {}, signal),
    listDefs(db, "lead", {}, signal),
    listDefs(db, "deal", {}, signal),
  ]);
  return groups
    .flat()
    .filter((def) => def.archivedAt === null && ALLOWED_CUSTOM_FIELD_TYPES.has(def.type));
}

async function customFieldIssues(
  db: Db,
  fields: FormField[],
  signal: AbortSignal,
): Promise<string[]> {
  const customKeys = fields
    .map((field) => field.key)
    .filter((key): key is `cf_${string}` => key.startsWith("cf_"));
  if (customKeys.length === 0) return [];
  const eligible = await listEligibleCustomFields(db, signal);
  const ids = new Set(eligible.map((def) => def.id));
  return customKeys
    .filter((key) => !ids.has(key.slice(3)))
    .map((key) => `${key} is not an eligible custom field`);
}

interface ResolvedDefinition {
  fields: FormField[];
  creates: "lead" | "deal";
  pipelineId: string | null;
  stageId: string | null;
  ownerId: string;
  redirectUrl: string | null;
  successMessage: string;
}

function checkRedirectUrl(value: string | null | undefined): Result<string | null, AppError> {
  const redirectUrl = value ?? null;
  if (redirectUrl === null) return ok(null);
  let parsed: URL | null = null;
  try {
    parsed = new URL(redirectUrl);
  } catch {
    parsed = null;
  }
  if (parsed === null || parsed.protocol !== "https:") {
    return err(definitionInvalid(["redirect URL must be an https URL"]));
  }
  return ok(redirectUrl);
}

interface DealTarget {
  pipelineId: string;
  stageId: string;
}

async function resolveDealTarget(
  db: Db,
  raw: z.infer<typeof formInputSchema>,
  signal: AbortSignal,
): Promise<Result<DealTarget | null, AppError>> {
  if (raw.creates !== "deal") return ok(null);
  if (raw.pipelineId === null || raw.pipelineId === undefined) {
    return err(definitionInvalid(["a deal form needs a pipeline"]));
  }
  if (raw.stageId === null || raw.stageId === undefined) {
    return err(definitionInvalid(["a deal form needs a stage"]));
  }
  signal.throwIfAborted();
  const [stage] = await db
    .select({ id: stages.id, pipelineId: stages.pipelineId })
    .from(stages)
    .where(eq(stages.id, raw.stageId));
  if (stage === undefined || stage.pipelineId !== raw.pipelineId) {
    return err(definitionInvalid(["the stage does not belong to that pipeline"]));
  }
  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.id, raw.pipelineId));
  if (pipeline === undefined) return err(definitionInvalid(["pipeline not found"]));
  return ok({ pipelineId: raw.pipelineId, stageId: raw.stageId });
}

async function resolveDefinition(
  db: Db,
  raw: z.infer<typeof formInputSchema>,
  signal: AbortSignal,
): Promise<Result<ResolvedDefinition, AppError>> {
  signal.throwIfAborted();

  const issues = await customFieldIssues(db, raw.fields, signal);
  if (issues.length > 0) return err(definitionInvalid(issues));

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, raw.ownerId), eq(users.isActive, true)));
  if (owner === undefined) return err(definitionInvalid(["owner is not an active user"]));

  const redirect = checkRedirectUrl(raw.redirectUrl);
  if (!redirect.ok) return redirect;

  const target = await resolveDealTarget(db, raw, signal);
  if (!target.ok) return target;

  return ok({
    fields: raw.fields,
    creates: raw.creates,
    pipelineId: target.value?.pipelineId ?? null,
    stageId: target.value?.stageId ?? null,
    ownerId: raw.ownerId,
    redirectUrl: redirect.value,
    successMessage: raw.successMessage ?? "Thanks, we will be in touch.",
  });
}

export async function createForm(
  db: Db,
  actor: PermSetUser,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<WebForm, AppError>> {
  if (!canManageForms(actor)) return err(denied(actor));
  const parsed = formInputSchema.safeParse(input);
  if (!parsed.success) return err(invalid(parsed.error.issues));
  const definition = await resolveDefinition(db, parsed.data, signal);
  if (!definition.ok) return definition;
  signal.throwIfAborted();

  const [row] = await db
    .insert(webForms)
    .values({
      publicId: newPublicId(),
      name: parsed.data.name,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fields: definition.value.fields,
      creates: definition.value.creates,
      pipelineId: definition.value.pipelineId,
      stageId: definition.value.stageId,
      ownerId: definition.value.ownerId,
      successMessage: definition.value.successMessage,
      redirectUrl: definition.value.redirectUrl,
      active: parsed.data.active ?? true,
      createdBy: actor.id,
    })
    .returning();
  if (row === undefined) return err(notFound("new"));
  return ok(row);
}

export async function updateForm(
  db: Db,
  actor: PermSetUser,
  id: string,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<WebForm, AppError>> {
  if (!canManageForms(actor)) return err(denied(actor));
  const parsed = formPatchSchema.safeParse(input);
  if (!parsed.success) return err(invalid(parsed.error.issues));

  const existing = await getForm(db, id, signal);
  if (existing === null) return err(notFound(id));

  // Cross-field rules need the merged definition, not just the patch.
  const merged = formInputSchema.safeParse({
    name: parsed.data.name ?? existing.name,
    title: parsed.data.title ?? existing.title,
    description:
      parsed.data.description === undefined ? existing.description : parsed.data.description,
    fields: parsed.data.fields ?? (existing.fields as FormField[]),
    creates: parsed.data.creates ?? existing.creates,
    pipelineId: parsed.data.pipelineId === undefined ? existing.pipelineId : parsed.data.pipelineId,
    stageId: parsed.data.stageId === undefined ? existing.stageId : parsed.data.stageId,
    ownerId: parsed.data.ownerId ?? existing.ownerId,
    successMessage: parsed.data.successMessage ?? existing.successMessage,
    redirectUrl:
      parsed.data.redirectUrl === undefined ? existing.redirectUrl : parsed.data.redirectUrl,
    active: parsed.data.active ?? existing.active,
  });
  if (!merged.success) return err(invalid(merged.error.issues));

  const definition = await resolveDefinition(db, merged.data, signal);
  if (!definition.ok) return definition;
  signal.throwIfAborted();

  const [row] = await db
    .update(webForms)
    .set({
      name: merged.data.name,
      title: merged.data.title,
      description: merged.data.description ?? null,
      fields: definition.value.fields,
      creates: definition.value.creates,
      pipelineId: definition.value.pipelineId,
      stageId: definition.value.stageId,
      ownerId: definition.value.ownerId,
      successMessage: definition.value.successMessage,
      redirectUrl: definition.value.redirectUrl,
      active: merged.data.active ?? existing.active,
      updatedAt: new Date(),
    })
    .where(eq(webForms.id, id))
    .returning();
  if (row === undefined) return err(notFound(id));
  return ok(row);
}

export async function setFormActive(
  db: Db,
  actor: PermSetUser,
  id: string,
  active: boolean,
  signal: AbortSignal,
): Promise<Result<WebForm, AppError>> {
  return updateForm(db, actor, id, { active }, signal);
}

export async function deleteForm(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  if (!canManageForms(actor)) return err(denied(actor));
  signal.throwIfAborted();
  const [row] = await db.delete(webForms).where(eq(webForms.id, id)).returning({ id: webForms.id });
  if (row === undefined) return err(notFound(id));
  return ok(undefined);
}

export interface SubmissionWithLinks {
  id: string;
  formId: string;
  values: Record<string, unknown>;
  personId: string | null;
  leadId: string | null;
  dealId: string | null;
  createdAt: Date;
  personName: string | null;
  leadTitle: string | null;
  dealTitle: string | null;
}

export async function listSubmissions(
  db: Db,
  actor: PermSetUser,
  formId: string,
  signal: AbortSignal,
  limit = 100,
): Promise<Result<SubmissionWithLinks[], AppError>> {
  if (!canManageForms(actor)) return err(denied(actor));
  signal.throwIfAborted();
  const rows = await db
    .select({
      id: webFormSubmissions.id,
      formId: webFormSubmissions.formId,
      values: webFormSubmissions.values,
      personId: webFormSubmissions.personId,
      leadId: webFormSubmissions.leadId,
      dealId: webFormSubmissions.dealId,
      createdAt: webFormSubmissions.createdAt,
      personName: persons.name,
      leadTitle: leads.title,
      dealTitle: deals.title,
    })
    .from(webFormSubmissions)
    .leftJoin(persons, eq(persons.id, webFormSubmissions.personId))
    .leftJoin(leads, eq(leads.id, webFormSubmissions.leadId))
    .leftJoin(deals, eq(deals.id, webFormSubmissions.dealId))
    .where(eq(webFormSubmissions.formId, formId))
    .orderBy(desc(webFormSubmissions.createdAt))
    .limit(limit);
  signal.throwIfAborted();
  return ok(
    rows.map((row) => ({
      ...row,
      values: (row.values ?? {}) as Record<string, unknown>,
    })),
  );
}

/** Field keys a submission may carry, used by the public page and the submit service. */
export function formFieldKeys(form: WebForm): FormFieldKey[] {
  return (form.fields as FormField[]).map((field) => field.key);
}
