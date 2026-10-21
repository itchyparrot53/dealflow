import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { type Activity, activities, activityRecurrence, userPreferences } from "@/db/schema";
import { emitDomainEvent } from "@/features/events/emit";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { isValidTimeZone, utcToZoned } from "@/features/scheduling/zonedTime";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { resolveActivityVisibility } from "../visibility";
import { nextOccurrence } from "./next";
import { type RecurrenceRule, recurrenceRuleSchema } from "./rule";

// Recurring activities (6.6). Recurrence lives in a side table keyed by activity; every occurrence
// is a normal activity sharing a series_id, and the next one is only created when the current one
// is completed. Rules are stored only after the shared Zod schema accepted them.

export type Recurrence = typeof activityRecurrence.$inferSelect;

async function activityForActor(
  db: Db,
  actor: PermSetUser,
  activityId: string,
  signal: AbortSignal,
): Promise<Result<Activity, AppError>> {
  const [current] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), isNull(activities.deletedAt)));
  if (current === undefined) {
    return err(
      new AppError(ERROR_IDS.ACTIVITY_NOT_FOUND, "activity not found", { id: activityId }),
    );
  }
  const vis = await resolveActivityVisibility(db, current, signal);
  if (vis === null || !can(actor, "activity.edit", vis)) {
    return err(
      new AppError(ERROR_IDS.ACTIVITY_NOT_FOUND, "activity not found", { id: activityId }),
    );
  }
  return ok(current);
}

// Dates are computed in the assignee's zone (user_preferences.timezone, else UTC), keeping the
// local time of day through DST changes.
export async function timezoneForUser(
  db: DbOrTx,
  userId: string,
  signal: AbortSignal,
): Promise<string> {
  const [row] = await db
    .select({ timezone: userPreferences.timezone })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  signal.throwIfAborted();
  const tz = row?.timezone;
  return tz !== null && tz !== undefined && isValidTimeZone(tz) ? tz : "UTC";
}

export async function getRecurrence(
  db: DbOrTx,
  activityId: string,
  signal: AbortSignal,
): Promise<Recurrence | null> {
  const [row] = await db
    .select()
    .from(activityRecurrence)
    .where(eq(activityRecurrence.activityId, activityId));
  signal.throwIfAborted();
  return row ?? null;
}

export async function setRecurrence(
  db: Db,
  actor: PermSetUser,
  activityId: string,
  rawRule: unknown,
  signal: AbortSignal,
): Promise<Result<Recurrence | null, AppError>> {
  const current = await activityForActor(db, actor, activityId, signal);
  if (!current.ok) return current;

  const existing = await getRecurrence(db, activityId, signal);
  if (rawRule === null) {
    if (existing === null) return ok(null);
    const [ended] = await db
      .update(activityRecurrence)
      .set({ ended: true })
      .where(eq(activityRecurrence.activityId, activityId))
      .returning();
    return ok(ended ?? null);
  }

  const parsed = recurrenceRuleSchema.safeParse(rawRule);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.RECUR_RULE_INVALID, "invalid repeat rule", {
        issues: parsed.error.issues,
      }),
    );
  }
  const rule: RecurrenceRule = parsed.data;
  if (current.value.dueAt === null) {
    return err(
      new AppError(ERROR_IDS.RECUR_RULE_INVALID, "a repeating activity needs a due date", {
        issues: ["dueAt"],
      }),
    );
  }
  const tz = await timezoneForUser(db, current.value.assigneeId, signal);
  const anchorDay = Number(utcToZoned(current.value.dueAt, tz).date.slice(8, 10));

  if (existing !== null) {
    // Editing on one occurrence updates only this row, so later occurrences follow the new rule
    // while earlier ones (and this one's past) stay as they were.
    const [row] = await db
      .update(activityRecurrence)
      .set({ rule, ended: false })
      .where(eq(activityRecurrence.activityId, activityId))
      .returning();
    return ok(row ?? null);
  }

  const [row] = await db
    .insert(activityRecurrence)
    .values({
      activityId,
      seriesId: randomUUID(),
      rule,
      anchorDay,
      occurrence: 1,
      ended: false,
    })
    .returning();
  return ok(row ?? null);
}

// Called inside completeActivity's transaction on the false-to-true transition only. Returns the
// newly created occurrence, or null when the series ended or the rule has no next date.
export async function createNextOccurrence(
  tx: DbOrTx,
  current: Activity,
  actorId: string,
  signal: AbortSignal,
): Promise<Activity | null> {
  const series = await getRecurrence(tx, current.id, signal);
  if (series === null || series.ended || current.dueAt === null) return null;

  const parsed = recurrenceRuleSchema.safeParse(series.rule);
  if (!parsed.success) return null;

  const tz = await timezoneForUser(tx, current.assigneeId, signal);
  const next = nextOccurrence(
    parsed.data,
    { dueAt: current.dueAt, allDay: current.allDay },
    series.anchorDay,
    series.occurrence,
    tz,
  );
  if (next === null) return null;

  const shiftMs = next.getTime() - current.dueAt.getTime();
  const [row] = await tx
    .insert(activities)
    .values({
      typeId: current.typeId,
      subject: current.subject,
      priority: current.priority,
      dueAt: next,
      allDay: current.allDay,
      endAt: current.endAt === null ? null : new Date(current.endAt.getTime() + shiftMs),
      durationMinutes: current.durationMinutes,
      ownerId: current.ownerId,
      assigneeId: current.assigneeId,
      dealId: current.dealId,
      leadId: current.leadId,
      personId: current.personId,
      orgId: current.orgId,
      customFields: current.customFields,
      location: current.location,
      note: current.note,
      videoCallUrl: current.videoCallUrl,
      done: false,
      doneAt: null,
    })
    .returning();
  if (row === undefined) return null;

  await tx.insert(activityRecurrence).values({
    activityId: row.id,
    seriesId: series.seriesId,
    rule: parsed.data,
    anchorDay: series.anchorDay,
    occurrence: series.occurrence + 1,
    ended: false,
  });

  await emitDomainEvent(
    tx,
    { type: "activity.created", entityType: "activity", entityId: row.id, actorId },
    signal,
  );
  return row;
}
