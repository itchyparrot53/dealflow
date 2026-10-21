import { and, asc, eq, isNull, type SQL, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { projects, projectTasks } from "@/db/schema";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import type { DealVisibilitySession } from "@/types/session";

// Project visibility (6.6): a project linked to a deal follows that deal's visibility predicate;
// an unlinked project is visible to every signed-in user. Edit rights are separate: the owner,
// any task assignee, or an admin.

export function projectVisibilitySession(actor: PermSetUser): DealVisibilitySession {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
  };
}

export function projectVisibilityClause(actor: PermSetUser): SQL {
  const dealVisible = dealVisibilityClause(projectVisibilitySession(actor));
  // The subquery uses the alias pair (d deals, p pipelines) the predicate requires. A deleted or
  // archived-pipeline deal is hidden from every read, so a project linked to one is too.
  return sql`(
    ${projects.dealId} IS NULL
    OR EXISTS (
      SELECT 1
      FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      WHERE d.id = ${projects.dealId}
        AND d.deleted_at IS NULL
        AND p.is_archived = false
        AND ${dealVisible}
    )
  )`;
}

export function notFound(): AppError {
  return new AppError(ERROR_IDS.PROJECT_NOT_FOUND, "project not found or not visible");
}

export function forbidden(): AppError {
  return new AppError(ERROR_IDS.PROJECT_FORBIDDEN, "not a project owner, assignee or admin");
}

export async function loadVisibleProject(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  signal: AbortSignal,
): Promise<Result<typeof projects.$inferSelect, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), isNull(projects.deletedAt), projectVisibilityClause(actor)),
    );
  signal.throwIfAborted();
  if (row === undefined) return err(notFound());
  return ok(row);
}

export interface EditableProject {
  project: typeof projects.$inferSelect;
  assigneeIds: string[];
}

// Visibility first (so an invisible project is E_PROJECT_001, not a permission error), then the
// owner/assignee/admin rule.
export async function loadEditableProject(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  signal: AbortSignal,
): Promise<Result<EditableProject, AppError>> {
  const visible = await loadVisibleProject(db, actor, projectId, signal);
  if (!visible.ok) return visible;

  const assigneeRows = await db
    .selectDistinct({ assigneeId: projectTasks.assigneeId })
    .from(projectTasks)
    .where(and(eq(projectTasks.projectId, projectId), sql`${projectTasks.assigneeId} is not null`))
    .orderBy(asc(projectTasks.assigneeId));
  signal.throwIfAborted();
  const assigneeIds = assigneeRows.flatMap((row) =>
    row.assigneeId === null ? [] : [row.assigneeId],
  );

  if (!canEditProject(actor, visible.value.ownerId, assigneeIds)) return err(forbidden());
  return ok({ project: visible.value, assigneeIds });
}

export function canEditProject(
  actor: PermSetUser,
  ownerId: string,
  assigneeIds: readonly string[],
): boolean {
  return actor.type === "admin" || actor.id === ownerId || assigneeIds.includes(actor.id);
}
