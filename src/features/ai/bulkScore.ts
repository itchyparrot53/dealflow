import { sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { BULK_SCORE_MAX } from "@/constants/insights";
import { PGBOSS_QUEUE_AI_BULK_SCORE } from "@/constants/jobNames";
import type { Db } from "@/db/client";
import { toVisibleDeal } from "@/features/deals/dealAuth";
import { dealVisibilityClause } from "@/features/deals/visibility";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { getBoss } from "@/jobs/boss";
import { err, ok, type Result } from "@/types/result";
import type { DealVisibilitySession } from "@/types/session";

// Enqueues one bulk scoring job. The requested ids are narrowed twice before the queue sees them:
// the visibility predicate drops deals the actor cannot see, and can(deal.edit) drops the visible
// ones they may not change. Dropped ids are silent by design, matching the other bulk actions.

export const bulkScoreInput = z.object({
  dealIds: z.array(z.uuid()).min(1).max(BULK_SCORE_MAX),
});

export interface BulkScoreQueued {
  queued: number;
}

function toSession(actor: PermSetUser): DealVisibilitySession {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
  };
}

function uuidListSql(ids: string[]) {
  return ids.map((id) => sql`${id}::uuid`).reduce((acc, part) => sql`${acc}, ${part}`);
}

interface StageRow {
  id: string;
  ownerId: string;
  visibilityLevel: "owner" | "group" | "all";
  visibilityGroupId: string | null;
  visibleToUserIds: string[];
  pipelineVisibilityGroupId: string | null;
}

async function editableDealIds(
  db: Db,
  actor: PermSetUser,
  ids: string[],
  signal: AbortSignal,
): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT
      d.id,
      d.owner_id          AS "ownerId",
      d.visibility_level  AS "visibilityLevel",
      d.visibility_group_id AS "visibilityGroupId",
      d.visible_to_user_ids AS "visibleToUserIds",
      p.visibility_group_id AS "pipelineVisibilityGroupId"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    WHERE d.id = ANY(ARRAY[${uuidListSql(ids)}]::uuid[])
      AND d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND ${dealVisibilityClause(toSession(actor))}
  `);
  signal.throwIfAborted();
  const rows = (result as unknown as { rows: StageRow[] }).rows;
  const editable = new Set(
    rows
      .filter((row) => can(actor, "deal.edit", toVisibleDeal(row, row.pipelineVisibilityGroupId)))
      .map((row) => row.id),
  );
  // Keep the order the caller sent so the job scores in a predictable order.
  return ids.filter((id) => editable.has(id));
}

export async function bulkScoreDeals(
  db: Db,
  actor: PermSetUser,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<BulkScoreQueued, AppError>> {
  const parsed = bulkScoreInput.safeParse(input);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.INSIGHT_INPUT_INVALID, "invalid bulk score input", {
        issues: parsed.error.issues,
      }),
    );
  }
  const ids = [...new Set(parsed.data.dealIds)];
  const allowed = await editableDealIds(db, actor, ids, signal);
  if (allowed.length === 0) return ok({ queued: 0 });

  const boss = getBoss();
  if (boss === null) {
    // A user action that promises a notification must not silently drop the job.
    return err(new AppError(ERROR_IDS.JOBS_BOSS_MISSING, "no job queue is running"));
  }
  await boss.send(PGBOSS_QUEUE_AI_BULK_SCORE, { requesterId: actor.id, dealIds: allowed });
  return ok({ queued: allowed.length });
}
