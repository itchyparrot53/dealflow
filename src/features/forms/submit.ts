import { and, eq, isNull, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { organizations, persons, users, webFormSubmissions, webForms } from "@/db/schema";
import { createNote } from "@/features/collaboration/notesRepo";
import { loadContactActor } from "@/features/contacts/actorAdapters";
import { createOrg } from "@/features/contacts/orgsRepo";
import type { ContactActor } from "@/features/contacts/personsRepo";
import { createPerson } from "@/features/contacts/personsRepo";
import { createDeal } from "@/features/deals/dealActions";
import { loadEntityCreateSession } from "@/features/entity-create/session";
import { emitDomainEvent } from "@/features/events/emit";
import { createLead } from "@/features/leads/leadActions";
import { createNotification } from "@/features/notifications/produce";
import type { PermSetUser } from "@/features/permissions/effective";
import type { EntityCreateSession } from "@/features/permissions/entityCreate";
import { hydrateActor } from "@/server/hydrateActor";
import type { CustomFieldDef } from "@/types/customFields";
import { err, ok, type Result } from "@/types/result";
import { type FormField, validateSubmission } from "./fields";
import { listEligibleCustomFields, type WebForm } from "./forms";
import { checkFormToken } from "./spamToken";

// The public submit path. It trusts only the public id, the signed token and the submitted values:
// no session is read, and the record is created as the form owner through the same services a
// signed-in user would use, so permissions, change logs and events behave identically.

type Person = typeof persons.$inferSelect;

export interface PublicForm {
  form: WebForm;
  ownerId: string;
}

export interface SubmitFormInput {
  values: Record<string, unknown>;
  website?: string;
  token: string;
}

export interface SubmitOutcome {
  message: string;
  redirectUrl: string | null;
  leadId: string | null;
  dealId: string | null;
}

const UNAVAILABLE = (publicId: string): AppError =>
  new AppError(ERROR_IDS.FORM_NOT_FOUND, "form unavailable", { publicId });

/** The form if it is active and its owner is active; null makes the two cases indistinguishable. */
export async function loadPublicForm(
  db: Db,
  publicId: string,
  signal: AbortSignal,
): Promise<PublicForm | null> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ form: webForms, ownerActive: users.isActive })
    .from(webForms)
    .leftJoin(users, eq(users.id, webForms.ownerId))
    .where(eq(webForms.publicId, publicId));
  signal.throwIfAborted();
  if (row === undefined || !row.form.active || row.ownerActive !== true) return null;
  return { form: row.form, ownerId: row.form.ownerId };
}

function customFieldValues(
  defs: CustomFieldDef[],
  fields: FormField[],
  values: Record<string, string>,
  target: "person" | "lead" | "deal",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.key.startsWith("cf_")) continue;
    const def = defs.find((candidate) => candidate.id === field.key.slice(3));
    if (def === undefined || def.targetEntity !== target) continue;
    const raw = values[field.key];
    if (raw === undefined) continue;
    // Number fields are stored as numbers; everything else keeps its validated string form.
    out[def.key] = def.type === "numeric" ? Number(raw) : raw;
  }
  return out;
}

function noteBody(values: Record<string, string>): string {
  const parts: string[] = [];
  if (values.job_title !== undefined) parts.push(`Job title: ${values.job_title}`);
  if (values.message !== undefined) parts.push(values.message);
  if (values.phone !== undefined) parts.push(`Phone: ${values.phone}`);
  return parts.join("\n\n");
}

function contactPoints(value: string | undefined, label: "work" | "mobile") {
  return value === undefined ? [] : [{ label, value, primary: true }];
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// A transaction handle exposes the same query surface as Db and its `.transaction()` is a
// savepoint, so passing it to the create services keeps the whole submission atomic.
function asDb(tx: Tx): Db {
  return tx;
}

interface SubmitContext {
  publicId: string;
  form: WebForm;
  owner: PermSetUser;
  contactActor: ContactActor;
  session: EntityCreateSession;
  values: Record<string, string>;
  fields: FormField[];
  defs: CustomFieldDef[];
  email: string;
  orgName: string;
  titleName: string;
}

// Find the visitor by email (citext, so the comparison ignores case) or create them.
async function findOrCreatePerson(
  tx: Tx,
  ctx: SubmitContext,
  signal: AbortSignal,
): Promise<Person> {
  const [existing] = await tx
    .select()
    .from(persons)
    .where(and(eq(persons.primaryEmail, ctx.email), isNull(persons.deletedAt)))
    .limit(1);
  if (existing !== undefined) return existing;

  const result = await createPerson(
    asDb(tx),
    ctx.contactActor,
    {
      name: ctx.values.name ?? ctx.email,
      emails: [{ label: "work", value: ctx.email, primary: true }],
      phones: contactPoints(ctx.values.phone, "mobile"),
      orgId: null,
      customFields: customFieldValues(ctx.defs, ctx.fields, ctx.values, "person"),
    },
    signal,
  );
  if (!result.ok) throw result.error;
  return result.value;
}

// Find the organization by lower(name) or create it, then link it when the person has none.
async function resolveOrganizationId(
  tx: Tx,
  ctx: SubmitContext,
  person: Person,
  signal: AbortSignal,
): Promise<string | null> {
  if (person.orgId !== null || ctx.orgName === "") return person.orgId;

  const [existing] = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        sql`lower(${organizations.name}) = ${ctx.orgName.toLowerCase()}`,
        isNull(organizations.deletedAt),
      ),
    )
    .limit(1);

  let orgId: string;
  if (existing !== undefined) {
    orgId = existing.id;
  } else {
    const result = await createOrg(
      asDb(tx),
      ctx.contactActor,
      { name: ctx.orgName, address: null, customFields: {} },
      signal,
    );
    if (!result.ok) throw result.error;
    orgId = result.value.id;
  }
  await tx.update(persons).set({ orgId, updatedAt: new Date() }).where(eq(persons.id, person.id));
  return orgId;
}

interface CreatedRecord {
  leadId: string | null;
  dealId: string | null;
}

async function createRecord(
  tx: Tx,
  ctx: SubmitContext,
  person: Person,
  orgId: string | null,
  signal: AbortSignal,
): Promise<CreatedRecord> {
  const title = `${ctx.titleName} via ${ctx.form.name}`;
  if (ctx.form.creates === "lead") {
    const result = await createLead(
      asDb(tx),
      ctx.session,
      {
        title,
        personId: person.id,
        orgId,
        sourceChannel: "web_form",
        sourceOrigin: "web_form",
        customFields: customFieldValues(ctx.defs, ctx.fields, ctx.values, "lead"),
      },
      signal,
    );
    if (!result.ok) throw result.error;
    return { leadId: result.value.id, dealId: null };
  }

  if (ctx.form.pipelineId === null || ctx.form.stageId === null) {
    throw UNAVAILABLE(ctx.publicId);
  }
  const result = await createDeal(
    asDb(tx),
    ctx.session,
    {
      title,
      pipelineId: ctx.form.pipelineId,
      stageId: ctx.form.stageId,
      personId: person.id,
      orgId,
      sourceChannel: "web_form",
      customFields: customFieldValues(ctx.defs, ctx.fields, ctx.values, "deal"),
    },
    signal,
  );
  if (!result.ok) throw result.error;
  return { leadId: null, dealId: result.value.id };
}

interface CreatedSubmission extends CreatedRecord {
  entityType: "lead" | "deal";
  entityId: string;
  submissionId: string;
}

async function persistSubmission(
  tx: Tx,
  ctx: SubmitContext,
  person: Person,
  created: CreatedRecord,
  signal: AbortSignal,
): Promise<CreatedSubmission> {
  const entityType = created.leadId === null ? "deal" : "lead";
  const entityId = created.leadId ?? created.dealId;
  if (entityId === null) throw UNAVAILABLE(ctx.publicId);

  const body = noteBody(ctx.values);
  if (body !== "") {
    const note = await createNote(
      asDb(tx),
      ctx.owner,
      { entityType, entityId, body, pinned: false },
      signal,
    );
    if (!note.ok) throw note.error;
  }

  const [submission] = await tx
    .insert(webFormSubmissions)
    .values({
      formId: ctx.form.id,
      values: ctx.values,
      personId: person.id,
      leadId: created.leadId,
      dealId: created.dealId,
    })
    .returning({ id: webFormSubmissions.id });
  if (submission === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "submission insert returned no row");
  }

  await tx
    .update(webForms)
    .set({ submissionCount: sql`${webForms.submissionCount} + 1`, updatedAt: new Date() })
    .where(eq(webForms.id, ctx.form.id));

  await emitDomainEvent(
    tx,
    {
      type: "form.submitted",
      entityType,
      entityId,
      actorId: ctx.owner.id,
      changes: [{ field: "form", old: null, new: ctx.form.id }],
    },
    signal,
  );

  return {
    ...created,
    entityType,
    entityId,
    submissionId: submission.id,
  };
}

async function performSubmission(
  db: Db,
  ctx: SubmitContext,
  signal: AbortSignal,
): Promise<CreatedSubmission> {
  return db.transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, ctx, signal);
    const orgId = await resolveOrganizationId(tx, ctx, person, signal);
    const created = await createRecord(tx, ctx, person, orgId, signal);
    return persistSubmission(tx, ctx, person, created, signal);
  });
}

function invalidSubmission(fieldErrors: Record<string, string>): AppError {
  return new AppError(ERROR_IDS.FORM_SUBMISSION_INVALID, "submission invalid", { fieldErrors });
}

export async function submitForm(
  db: Db,
  publicId: string,
  input: SubmitFormInput,
  now: number,
  signal: AbortSignal,
): Promise<Result<SubmitOutcome, AppError>> {
  const loaded = await loadPublicForm(db, publicId, signal);
  if (loaded === null) return err(UNAVAILABLE(publicId));
  const form = loaded.form;
  const silent: SubmitOutcome = {
    message: form.successMessage,
    redirectUrl: form.redirectUrl,
    leadId: null,
    dealId: null,
  };

  // Honeypot and a failed or too-fast token are accepted silently: a bot learns nothing and
  // nothing is written.
  if ((input.website ?? "").trim() !== "") return ok(silent);
  if (checkFormToken(publicId, input.token, now) !== "ok") return ok(silent);

  const defs = await listEligibleCustomFields(db, signal);
  const fields = form.fields as FormField[];
  const validated = validateSubmission(
    fields,
    input.values,
    new Map(defs.map((def) => [def.id, def])),
  );
  if (!validated.ok) return err(invalidSubmission(validated.error.fieldErrors));
  const values = validated.value;
  const email = values.email ?? "";
  if (email === "") return err(invalidSubmission({ email: "This field is required." }));

  const owner = await hydrateActor(db, form.ownerId, signal);
  if (owner === null) return err(UNAVAILABLE(publicId));

  const orgName = (values.organization ?? "").trim();
  const ctx: SubmitContext = {
    publicId,
    form,
    owner,
    contactActor: await loadContactActor(db, owner, signal),
    session: await loadEntityCreateSession(db, owner, signal),
    values,
    fields,
    defs,
    email,
    orgName,
    titleName: orgName !== "" ? orgName : (values.name ?? email),
  };

  let created: CreatedSubmission;
  try {
    created = await performSubmission(db, ctx, signal);
  } catch (error) {
    if (error instanceof AppError) return err(error);
    throw error;
  }

  // After commit. A failed in-app notification must not fail a submission the visitor completed.
  const notified = await createNotification(
    db,
    {
      recipientId: form.ownerId,
      type: "form_submission",
      entityType: created.entityType,
      entityId: created.entityId,
      actorId: null,
      payload: {
        formId: form.id,
        formName: form.name,
        name: values.name ?? "",
        email,
        title: ctx.titleName,
        submissionId: created.submissionId,
      },
    },
    signal,
  );
  if (!notified.ok) console.warn(`form submission notification failed: ${notified.error.id}`);

  return ok({
    message: form.successMessage,
    redirectUrl: form.redirectUrl,
    leadId: created.leadId,
    dealId: created.dealId,
  });
}
