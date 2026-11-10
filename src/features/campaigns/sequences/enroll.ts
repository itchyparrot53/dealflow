import { and, eq, inArray, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  activities,
  deals,
  leads,
  personMarketing,
  persons,
  sequenceEnrollments,
  sequenceSegmentMembers,
  sequences,
} from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { hydrateActor } from "@/server/hydrateActor";
import { err, ok, type Result } from "@/types/result";
import { previewSegment } from "../segment";
import {
  DEFAULT_SEND_WINDOW,
  nextSendTime,
  type SendWindow,
  type SequenceEntry,
  sendWindowSchema,
  sequenceEntrySchema,
} from "./model";
import { segmentMemberIds } from "./service";

// 6.10's entry paths. Every path ends in enrollPerson, which enforces the sequence's own entry flags,
// the active status and the consent rule; the unique partial index makes a concurrent second entry
// a no-op rather than a duplicate enrollment.

export type SequenceEnrollSource = "manual" | "segment" | "automation";

export interface EnrollPersonInput {
  sequenceId: string;
  personId: string;
  source: SequenceEnrollSource;
}

export interface EnrollPersonResult {
  enrolled: boolean;
  enrollmentId: string | null;
}

function entryOf(value: unknown): SequenceEntry {
  const parsed = sequenceEntrySchema.safeParse(value);
  return parsed.success ? parsed.data : { manual: true, automation: true, segment: null };
}

function sourceAllowed(entry: SequenceEntry, source: SequenceEnrollSource): boolean {
  if (source === "manual") return entry.manual;
  if (source === "automation") return entry.automation;
  return entry.segment !== null;
}

export async function enrollPerson(
  db: Db,
  input: EnrollPersonInput,
  signal: AbortSignal,
): Promise<Result<EnrollPersonResult, AppError>> {
  signal.throwIfAborted();
  const [sequence] = await db
    .select()
    .from(sequences)
    .where(eq(sequences.id, input.sequenceId))
    .limit(1);
  if (sequence === undefined) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "sequence not found", {
        sequenceId: input.sequenceId,
      }),
    );
  }
  if (sequence.status !== "active") {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "sequence is not active", {
        sequenceId: input.sequenceId,
      }),
    );
  }
  if (!sourceAllowed(entryOf(sequence.entry), input.source)) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "this entry path is disabled", {
        sequenceId: input.sequenceId,
        source: input.source,
      }),
    );
  }

  const [person] = await db
    .select({ id: persons.id, deletedAt: persons.deletedAt })
    .from(persons)
    .where(and(eq(persons.id, input.personId), isNull(persons.deletedAt)))
    .limit(1);
  if (person === undefined) {
    return err(
      new AppError(ERROR_IDS.CONTACT_NOT_FOUND, "person not found", { personId: input.personId }),
    );
  }
  const [marketing] = await db
    .select({ status: personMarketing.status })
    .from(personMarketing)
    .where(eq(personMarketing.personId, input.personId))
    .limit(1);
  if ((marketing?.status ?? "not_subscribed") !== "subscribed") {
    return err(
      new AppError(ERROR_IDS.MARKETING_NOT_SUBSCRIBED, "person is not subscribed", {
        personId: input.personId,
      }),
    );
  }

  const windowParsed = sendWindowSchema.safeParse(sequence.sendWindow);
  const window: SendWindow = windowParsed.success ? windowParsed.data : DEFAULT_SEND_WINDOW;
  const nextRunAt = nextSendTime(new Date(), window);
  const [enrollment] = await db
    .insert(sequenceEnrollments)
    .values({
      sequenceId: input.sequenceId,
      personId: input.personId,
      status: "active",
      currentPosition: 0,
      nextRunAt,
    })
    .onConflictDoNothing()
    .returning({ id: sequenceEnrollments.id });
  return ok({ enrolled: enrollment !== undefined, enrollmentId: enrollment?.id ?? null });
}

export interface BulkEnrollResult {
  enrolled: number;
  alreadyActive: number;
  failed: { id: string; errorId: string }[];
}

const BULK_ENROLL_MAX = 5000;

export async function bulkEnrollInSequence(
  db: Db,
  actor: PermSetUser,
  sequenceId: string,
  personIds: readonly string[],
  signal: AbortSignal,
): Promise<Result<BulkEnrollResult, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.send")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "campaigns.send required", { userId: actor.id }),
    );
  }
  if (personIds.length === 0 || personIds.length > BULK_ENROLL_MAX) {
    return err(new AppError(ERROR_IDS.BULK_TOO_MANY, "too many ids", { count: personIds.length }));
  }
  const result: BulkEnrollResult = { enrolled: 0, alreadyActive: 0, failed: [] };
  for (const personId of personIds) {
    signal.throwIfAborted();
    const enrolled = await enrollPerson(db, { sequenceId, personId, source: "manual" }, signal);
    if (!enrolled.ok) {
      result.failed.push({ id: personId, errorId: enrolled.error.id });
    } else if (enrolled.value.enrolled) {
      result.enrolled += 1;
    } else {
      result.alreadyActive += 1;
    }
  }
  return ok(result);
}

// The fifteen-minute segment-entry scan: every active sequence with a segment entry enrolls the
// newly matching people and remembers them. With allowReentry off a person who leaves and returns
// is not enrolled again; with it on the membership row is dropped when they leave.
async function enrollNewMatches(
  db: Db,
  sequenceId: string,
  personIds: readonly string[],
  signal: AbortSignal,
): Promise<number> {
  let enrolled = 0;
  for (const personId of personIds) {
    const result = await enrollPerson(db, { sequenceId, personId, source: "segment" }, signal);
    if (result.ok && result.value.enrolled) enrolled += 1;
    await db.insert(sequenceSegmentMembers).values({ sequenceId, personId }).onConflictDoNothing();
  }
  return enrolled;
}

async function clearLeftMembers(
  db: Db,
  sequenceId: string,
  members: ReadonlySet<string>,
  eligible: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<void> {
  const left = [...members].filter((personId) => !eligible.has(personId));
  if (left.length === 0) return;
  await db
    .delete(sequenceSegmentMembers)
    .where(
      and(
        eq(sequenceSegmentMembers.sequenceId, sequenceId),
        inArray(sequenceSegmentMembers.personId, left),
      ),
    );
  signal.throwIfAborted();
}

async function syncOneSequence(
  db: Db,
  sequence: typeof sequences.$inferSelect,
  signal: AbortSignal,
): Promise<{ touched: boolean; enrolled: number }> {
  const entry = entryOf(sequence.entry);
  if (entry.segment === null) return { touched: false, enrolled: 0 };
  const actor =
    sequence.createdBy === null ? null : await hydrateActor(db, sequence.createdBy, signal);
  if (actor === null) return { touched: false, enrolled: 0 };
  const preview = await previewSegment(
    db,
    actor,
    { kind: "saved_filter", savedFilterId: entry.segment.savedFilterId },
    signal,
  );
  if (!preview.ok) return { touched: false, enrolled: 0 };
  const eligible = new Set(preview.value.eligible.map((person) => person.id));
  const members = await segmentMemberIds(db, sequence.id, signal);
  const newlyMatching = [...eligible].filter((personId) => !members.has(personId));
  const enrolled =
    newlyMatching.length === 0 ? 0 : await enrollNewMatches(db, sequence.id, newlyMatching, signal);
  if (entry.segment.allowReentry) {
    await clearLeftMembers(db, sequence.id, members, eligible, signal);
  }
  return { touched: newlyMatching.length > 0, enrolled };
}

// The fifteen-minute segment-entry scan: every active sequence with a segment entry enrolls the
// newly matching people and remembers them. With allowReentry off a person who leaves and returns
// is not enrolled again; with it on the membership row is dropped when they leave.
export async function syncSegmentEntries(
  db: Db,
  signal: AbortSignal,
): Promise<{ sequences: number; enrolled: number }> {
  signal.throwIfAborted();
  const rows = await db.select().from(sequences).where(eq(sequences.status, "active"));
  signal.throwIfAborted();
  let enrolled = 0;
  let touched = 0;
  for (const sequence of rows) {
    signal.throwIfAborted();
    const result = await syncOneSequence(db, sequence, signal);
    if (result.touched) touched += 1;
    enrolled += result.enrolled;
  }
  return { sequences: touched, enrolled };
}

// The automation action resolves the run's person through the same entity shapes the runner uses.
export async function resolveActionPerson(
  db: Db,
  entityType: string,
  entityId: string,
  dealId: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  signal.throwIfAborted();
  if (entityType === "person") return entityId;
  if (entityType === "deal") {
    if (dealId === null) return null;
    const [deal] = await db
      .select({ personId: deals.personId })
      .from(deals)
      .where(eq(deals.id, dealId));
    return deal?.personId ?? null;
  }
  if (entityType === "lead") {
    const [lead] = await db
      .select({ personId: leads.personId })
      .from(leads)
      .where(eq(leads.id, entityId));
    return lead?.personId ?? null;
  }
  if (entityType === "activity") {
    const [activity] = await db
      .select({ personId: activities.personId })
      .from(activities)
      .where(eq(activities.id, entityId));
    return activity?.personId ?? null;
  }
  return null;
}
