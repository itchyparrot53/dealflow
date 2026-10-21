import { and, desc, eq } from "drizzle-orm";
import { env } from "@/config/env";
import type { Db } from "@/db/client";
import {
  activities,
  activityTypes,
  bookingPages,
  bookings,
  deals,
  dealTerms,
  documents,
  leads,
  organizations,
  persons,
  pipelines,
  stages,
  users,
  webFormSubmissions,
  webForms,
} from "@/db/schema";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import type { DomainEventType, EventChange } from "./types";

// Payload snapshots are built when the worker dispatches, not when the change happened. That is
// deliberate: a webhook consumer wants the record as it is now. Payloads carry ids, public fields
// and the record's owner, never tokens, secrets, password hashes or private notes.

export interface SnapshotEvent {
  eventId: number;
  type: DomainEventType;
  entityType: string;
  entityId: string;
  actorId: string | null;
  changes: EventChange[];
  createdAt: Date;
}

export interface EventPayload {
  id: string;
  type: DomainEventType;
  occurredAt: string;
  actorId: string | null;
  changes: EventChange[];
  data: Record<string, unknown>;
}

export interface EventTarget {
  pipelineId: string | null;
  stageId: string | null;
  documentKind: "quote" | "invoice" | null;
  // The form a form.submitted event came from; the trigger's optional form filter reads it.
  formId: string | null;
}

const USER_FIELDS = { id: users.id, name: users.name, email: users.email };

async function ownerSnapshot(db: DbOrTx, ownerId: string | null) {
  if (ownerId === null) return null;
  const [owner] = await db.select(USER_FIELDS).from(users).where(eq(users.id, ownerId));
  return owner ?? null;
}

async function dealData(db: DbOrTx, entityId: string): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(deals).where(eq(deals.id, entityId));
  if (row === undefined || row.deletedAt !== null) return { id: entityId };

  const [stage] = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(eq(stages.id, row.stageId));
  const [pipeline] = await db
    .select({ id: pipelines.id, name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.id, row.pipelineId));
  const [terms] = await db
    .select({ currency: dealTerms.currency })
    .from(dealTerms)
    .where(eq(dealTerms.dealId, row.id));
  const owner = await ownerSnapshot(db, row.ownerId);
  const person =
    row.personId === null
      ? null
      : ((
          await db
            .select({
              id: persons.id,
              name: persons.name,
              email: persons.primaryEmail,
            })
            .from(persons)
            .where(eq(persons.id, row.personId))
        )[0] ?? null);
  const org =
    row.orgId === null
      ? null
      : ((
          await db
            .select({ id: organizations.id, name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, row.orgId))
        )[0] ?? null);

  return {
    id: row.id,
    title: row.title,
    value: row.value,
    currency: terms?.currency ?? env.BASE_CURRENCY,
    status: row.status,
    stage: stage ?? null,
    pipeline: pipeline ?? null,
    owner,
    person,
    organization: org,
    expectedCloseDate: row.expectedCloseDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function personData(db: DbOrTx, entityId: string): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(persons).where(eq(persons.id, entityId));
  if (row === undefined || row.deletedAt !== null) return { id: entityId };
  const owner = await ownerSnapshot(db, row.ownerId);
  return {
    id: row.id,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    primaryEmail: row.primaryEmail,
    primaryPhone:
      row.phones.find((phone) => phone.primary === true)?.value ?? row.phones[0]?.value ?? null,
    owner,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function organizationData(db: DbOrTx, entityId: string): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(organizations).where(eq(organizations.id, entityId));
  if (row === undefined || row.deletedAt !== null) return { id: entityId };
  const owner = await ownerSnapshot(db, row.ownerId);
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    owner,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function activityData(db: DbOrTx, entityId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ activity: activities, typeKey: activityTypes.key })
    .from(activities)
    .leftJoin(activityTypes, eq(activityTypes.id, activities.typeId))
    .where(eq(activities.id, entityId));
  if (row === undefined || row.activity.deletedAt !== null) return { id: entityId };
  return {
    id: row.activity.id,
    // 6.5 names the activity type `type`; the key (call, task, ...) is the stable spelling.
    type: row.typeKey ?? row.activity.typeId,
    typeId: row.activity.typeId,
    subject: row.activity.subject,
    dueAt: row.activity.dueAt?.toISOString() ?? null,
    done: row.activity.done,
    dealId: row.activity.dealId,
    personId: row.activity.personId,
  };
}

async function documentData(db: DbOrTx, entityId: string): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(documents).where(eq(documents.id, entityId));
  if (row === undefined) return { id: entityId };
  return {
    id: row.id,
    kind: row.kind,
    number: row.number,
    status: row.status,
    total: row.total,
    currency: row.currency,
    dealId: row.dealId,
    publicUrl: `${env.BASE_URL}/d/${row.publicId}`,
  };
}

// The trigger match needs the pipeline, stage and document kind before any payload is built.
export async function loadEventTarget(
  db: DbOrTx,
  event: SnapshotEvent,
  signal: AbortSignal,
): Promise<EventTarget> {
  signal.throwIfAborted();
  if (event.entityType === "deal") {
    const [row] = await db
      .select({ pipelineId: deals.pipelineId, stageId: deals.stageId })
      .from(deals)
      .where(eq(deals.id, event.entityId));
    return {
      pipelineId: row?.pipelineId ?? null,
      stageId: row?.stageId ?? null,
      documentKind: null,
      formId: formIdOf(event),
    };
  }
  if (event.entityType === "document" || event.entityType === "invoice") {
    const [row] = await db
      .select({ kind: documents.kind })
      .from(documents)
      .where(eq(documents.id, event.entityId));
    return {
      pipelineId: null,
      stageId: null,
      documentKind: row?.kind === "quote" || row?.kind === "invoice" ? row.kind : null,
      formId: null,
    };
  }
  return { pipelineId: null, stageId: null, documentKind: null, formId: formIdOf(event) };
}

function changeValue(event: SnapshotEvent, field: string): string | null {
  const change = event.changes.find((entry) => entry.field === field);
  return typeof change?.new === "string" ? change.new : null;
}

function formIdOf(event: SnapshotEvent): string | null {
  return event.type === "form.submitted" ? changeValue(event, "form") : null;
}

// A form submission's payload carries the form, the answers, the record it created and the visitor.
async function formSubmissionData(
  db: DbOrTx,
  event: SnapshotEvent,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  const formId = formIdOf(event);
  const [form] =
    formId === null
      ? []
      : await db
          .select({ id: webForms.id, name: webForms.name })
          .from(webForms)
          .where(eq(webForms.id, formId));

  let recordId: string | null = null;
  let recordTitle: string | null = null;
  let personId: string | null = null;
  if (event.entityType === "deal") {
    const [row] = await db
      .select({ id: deals.id, title: deals.title, personId: deals.personId })
      .from(deals)
      .where(eq(deals.id, event.entityId));
    recordId = row?.id ?? null;
    recordTitle = row?.title ?? null;
    personId = row?.personId ?? null;
  } else if (event.entityType === "lead") {
    const [row] = await db
      .select({ id: leads.id, title: leads.title, personId: leads.personId })
      .from(leads)
      .where(eq(leads.id, event.entityId));
    recordId = row?.id ?? null;
    recordTitle = row?.title ?? null;
    personId = row?.personId ?? null;
  }

  const person =
    personId === null
      ? null
      : ((
          await db
            .select({ id: persons.id, name: persons.name, email: persons.primaryEmail })
            .from(persons)
            .where(eq(persons.id, personId))
        )[0] ?? null);

  const [submission] =
    formId === null || recordId === null
      ? []
      : await db
          .select({ values: webFormSubmissions.values })
          .from(webFormSubmissions)
          .where(
            event.entityType === "deal"
              ? and(eq(webFormSubmissions.formId, formId), eq(webFormSubmissions.dealId, recordId))
              : and(eq(webFormSubmissions.formId, formId), eq(webFormSubmissions.leadId, recordId)),
          )
          .orderBy(desc(webFormSubmissions.createdAt))
          .limit(1);

  const record = recordId === null ? null : { id: recordId, title: recordTitle };
  return {
    form: form ?? (formId === null ? null : { id: formId, name: null }),
    values: submission?.values ?? {},
    ...(event.entityType === "deal" ? { deal: record } : { lead: record }),
    person,
  };
}

async function bookingRow(
  db: DbOrTx,
  event: SnapshotEvent,
): Promise<{
  booking: typeof bookings.$inferSelect;
  pageTitle: string | null;
  hostId: string | null;
  hostName: string | null;
} | null> {
  const bookingId = changeValue(event, "booking");
  const [row] =
    bookingId !== null
      ? await db
          .select({
            booking: bookings,
            pageTitle: bookingPages.title,
            hostId: bookingPages.hostId,
            hostName: users.name,
          })
          .from(bookings)
          .leftJoin(bookingPages, eq(bookingPages.id, bookings.pageId))
          .leftJoin(users, eq(users.id, bookingPages.hostId))
          .where(eq(bookings.id, bookingId))
      : await db
          .select({
            booking: bookings,
            pageTitle: bookingPages.title,
            hostId: bookingPages.hostId,
            hostName: users.name,
          })
          .from(bookings)
          .leftJoin(bookingPages, eq(bookingPages.id, bookings.pageId))
          .leftJoin(users, eq(users.id, bookingPages.hostId))
          .where(eq(bookings.activityId, event.entityId))
          .orderBy(desc(bookings.createdAt))
          .limit(1);
  return row ?? null;
}

async function bookingData(
  db: DbOrTx,
  event: SnapshotEvent,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  const row = await bookingRow(db, event);
  if (row === null) return { booking: { id: changeValue(event, "booking") }, host: null };
  return {
    booking: {
      id: row.booking.id,
      start: row.booking.startAt.toISOString(),
      end: row.booking.endAt.toISOString(),
      status: row.booking.status,
      pageTitle: row.pageTitle,
      visitorName: row.booking.visitorName,
      visitorEmail: row.booking.visitorEmail,
    },
    host: row.hostId === null ? null : { id: row.hostId, name: row.hostName },
  };
}

export async function buildEventPayload(
  db: DbOrTx,
  event: SnapshotEvent,
  signal: AbortSignal,
): Promise<EventPayload> {
  signal.throwIfAborted();
  let data: Record<string, unknown>;
  if (event.type === "form.submitted") {
    data = await formSubmissionData(db, event, signal);
  } else if (event.type === "booking.created" || event.type === "booking.cancelled") {
    data = await bookingData(db, event, signal);
  } else
    switch (event.entityType) {
      case "deal":
        data = await dealData(db, event.entityId);
        break;
      case "person":
        data = await personData(db, event.entityId);
        break;
      case "organization":
        data = await organizationData(db, event.entityId);
        break;
      case "activity":
        data = await activityData(db, event.entityId);
        break;
      case "document":
      case "invoice":
        data = await documentData(db, event.entityId);
        break;
      default:
        data = { id: event.entityId };
    }
  return {
    id: `evt_${event.eventId}`,
    type: event.type,
    occurredAt: event.createdAt.toISOString(),
    actorId: event.actorId,
    changes: event.changes,
    data,
  };
}

export type { Db };
