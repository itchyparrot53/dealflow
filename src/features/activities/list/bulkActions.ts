"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { BULK_MAX } from "@/constants/productivity";
import { db } from "@/db/client";
import { activities } from "@/db/schema";
import { timezoneForUser } from "@/features/activities/recurrence/series";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { deleteActivity } from "../activityDelete";
import { updateActivity } from "../activityUpdate";
import { completeActivity } from "../repo";
import { rescheduledIso } from "./bulk";

// One server action for every Activities bulk action (1.4/6.6). It loops the existing services so
// permissions, change logs and domain events apply per row, and reports partial failure instead of
// abandoning the rows that did succeed (E_BULK_002 carries the failed ids and their error ids).

const bulkInput = z
  .object({
    kind: z.enum(["markDone", "reschedule", "owner", "delete"]),
    ids: z.array(z.string().uuid()).min(1),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    ownerId: z.string().uuid().optional(),
  })
  .strict();

export interface BulkFailure {
  id: string;
  errorId: string;
}

export type BulkActivityResult =
  | { ok: true; value: { applied: number; failed: BulkFailure[] } }
  | { ok: false; error: { id: string; failed: BulkFailure[] } };

export type BulkActivityKind = z.infer<typeof bulkInput>["kind"];

export async function bulkActivityAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<BulkActivityResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF", failed: [] } };

  const { actor } = await createContext();
  if (actor === null) {
    return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD, failed: [] } };
  }

  const parsed = bulkInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { id: ERROR_IDS.BULK_TOO_MANY, failed: [] } };
  }
  if (parsed.data.ids.length > BULK_MAX) {
    return { ok: false, error: { id: ERROR_IDS.BULK_TOO_MANY, failed: [] } };
  }
  const { kind, ids, date, ownerId } = parsed.data;

  const failed: BulkFailure[] = [];
  for (const id of ids) {
    const result = await runOne(kind, id, date, ownerId);
    if (!result.ok) failed.push({ id, errorId: result.errorId });
  }

  if (failed.length > 0) {
    return { ok: false, error: { id: ERROR_IDS.BULK_PARTIAL, failed } };
  }
  return { ok: true, value: { applied: ids.length, failed } };
}

async function runOne(
  kind: BulkActivityKind,
  id: string,
  date: string | undefined,
  ownerId: string | undefined,
): Promise<{ ok: true } | { ok: false; errorId: string }> {
  const { actor } = await createContext();
  if (actor === null) return { ok: false, errorId: ERROR_IDS.AUTH_SESSION_DEAD };

  if (kind === "markDone") {
    const result = await completeActivity(db, actor, id, true, SIG());
    return result.ok ? { ok: true } : { ok: false, errorId: result.error.id };
  }
  if (kind === "delete") {
    const result = await deleteActivity(db, actor, id, SIG());
    return result.ok ? { ok: true } : { ok: false, errorId: result.error.id };
  }
  if (kind === "owner") {
    if (ownerId === undefined) return { ok: false, errorId: ERROR_IDS.BULK_TOO_MANY };
    const result = await updateActivity(db, actor, { id, assigneeId: ownerId }, SIG());
    return result.ok ? { ok: true } : { ok: false, errorId: result.error.id };
  }
  if (date === undefined) return { ok: false, errorId: ERROR_IDS.BULK_TOO_MANY };
  const [row] = await db
    .select({
      dueAt: activities.dueAt,
      allDay: activities.allDay,
      assigneeId: activities.assigneeId,
    })
    .from(activities)
    .where(eq(activities.id, id));
  if (row === undefined) return { ok: false, errorId: ERROR_IDS.ACTIVITY_NOT_FOUND };
  const tz = await timezoneForUser(db, row.assigneeId, SIG());
  const dueAt = rescheduledIso(row.dueAt?.toISOString() ?? null, date, row.allDay, tz);
  const result = await updateActivity(db, actor, { id, dueAt, allDay: row.allDay }, SIG());
  return result.ok ? { ok: true } : { ok: false, errorId: result.error.id };
}
