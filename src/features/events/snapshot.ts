import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import type { Db } from "@/db/client";
import {
  activities,
  deals,
  dealTerms,
  documents,
  organizations,
  persons,
  pipelines,
  stages,
  users,
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
  const [row] = await db.select().from(activities).where(eq(activities.id, entityId));
  if (row === undefined || row.deletedAt !== null) return { id: entityId };
  return {
    id: row.id,
    typeId: row.typeId,
    subject: row.subject,
    dueAt: row.dueAt?.toISOString() ?? null,
    done: row.done,
    dealId: row.dealId,
    personId: row.personId,
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
    };
  }
  return { pipelineId: null, stageId: null, documentKind: null };
}

export async function buildEventPayload(
  db: DbOrTx,
  event: SnapshotEvent,
  signal: AbortSignal,
): Promise<EventPayload> {
  signal.throwIfAborted();
  let data: Record<string, unknown>;
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
