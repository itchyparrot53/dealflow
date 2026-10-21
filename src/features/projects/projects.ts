import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { PROJECT_DEFAULT_PHASES } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { deals, projectPhases, projects, projectTasks, users } from "@/db/schema";
import { emitDomainEvent } from "@/features/events/emit";
import { canActorAccessParent } from "@/features/files/fileAuthz";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import type { PhaseView, ProjectFilter, ProjectListItem, ProjectView, TaskView } from "./types";
import {
  loadEditableProject,
  loadVisibleProject,
  notFound,
  projectVisibilityClause,
} from "./visibility";

// Project reads and lifecycle. Mutations run in one transaction so the row and its phases land
// together and the domain event is written with them (6.6). Phases and tasks live in their own
// modules, which share visibility.ts for the edit guard.

const linkId = z.uuid().nullable().optional();
const dateOnly = z.string().date().nullable().optional();

export const createProjectInput = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000).nullable().optional(),
  dealId: linkId,
  organizationId: linkId,
  personId: linkId,
  ownerId: z.uuid().optional(),
  startDate: dateOnly,
  dueDate: dateOnly,
  phases: z.array(z.string().trim().min(1).max(80)).min(1).max(10).optional(),
});

export const updateProjectInput = createProjectInput.partial();
export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "cancelled"]);

export function invalidProjectInput(issues: unknown): AppError {
  return new AppError(ERROR_IDS.PROJECT_INPUT_INVALID, "invalid project input", { issues });
}

function asPhase(row: typeof projectPhases.$inferSelect): PhaseView {
  return { id: row.id, name: row.name, position: row.position };
}

function asTask(row: typeof projectTasks.$inferSelect, assigneeName: string | null): TaskView {
  return {
    id: row.id,
    projectId: row.projectId,
    phaseId: row.phaseId,
    title: row.title,
    description: row.description,
    assigneeId: row.assigneeId,
    assigneeName,
    dueDate: row.dueDate,
    done: row.done,
    doneAt: row.doneAt?.toISOString() ?? null,
    position: row.position,
  };
}

export async function loadProjectView(
  db: Db,
  project: typeof projects.$inferSelect,
): Promise<ProjectView> {
  const [owner] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, project.ownerId));
  const deal =
    project.dealId === null
      ? []
      : await db.select({ title: deals.title }).from(deals).where(eq(deals.id, project.dealId));
  const [phaseRows, taskRows] = await Promise.all([
    db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, project.id))
      .orderBy(asc(projectPhases.position), asc(projectPhases.id)),
    db
      .select({ task: projectTasks, assigneeName: users.name })
      .from(projectTasks)
      .leftJoin(users, eq(users.id, projectTasks.assigneeId))
      .where(eq(projectTasks.projectId, project.id))
      .orderBy(asc(projectTasks.position), asc(projectTasks.createdAt)),
  ]);
  const tasks = taskRows.map((row) => asTask(row.task, row.assigneeName ?? null));
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status as ProjectView["status"],
    dealId: project.dealId,
    dealTitle: deal[0]?.title ?? null,
    organizationId: project.organizationId,
    personId: project.personId,
    ownerId: project.ownerId,
    ownerName: owner?.name ?? project.ownerId,
    startDate: project.startDate,
    dueDate: project.dueDate,
    completedAt: project.completedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    phases: phaseRows.map(asPhase),
    tasks,
    taskCount: tasks.length,
    doneCount: tasks.filter((task) => task.done).length,
  };
}

function escapedLike(search: string): string {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function listProjects(
  db: Db,
  actor: PermSetUser,
  filter: ProjectFilter,
  signal: AbortSignal,
): Promise<ProjectListItem[]> {
  signal.throwIfAborted();
  const where = [isNull(projects.deletedAt), projectVisibilityClause(actor)];
  if (filter.status !== undefined) where.push(eq(projects.status, filter.status));
  if (filter.ownerId !== undefined) where.push(eq(projects.ownerId, filter.ownerId));
  if (filter.dealId !== undefined) where.push(eq(projects.dealId, filter.dealId));
  const term = filter.search?.trim() ?? "";
  if (term !== "") {
    const pattern = escapedLike(term);
    const search = or(ilike(projects.name, pattern), ilike(projects.description, pattern));
    if (search !== undefined) where.push(search);
  }

  const rows = await db
    .select({ project: projects, ownerName: users.name, dealTitle: deals.title })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.ownerId))
    .leftJoin(deals, eq(deals.id, projects.dealId))
    .where(and(...where))
    .orderBy(desc(projects.updatedAt));
  signal.throwIfAborted();
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.project.id);
  const counts = await db
    .select({
      projectId: projectTasks.projectId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${projectTasks.done})::int`,
    })
    .from(projectTasks)
    .where(inArray(projectTasks.projectId, ids))
    .groupBy(projectTasks.projectId);
  const byProject = new Map(counts.map((row) => [row.projectId, row]));

  return rows.map((row) => ({
    id: row.project.id,
    name: row.project.name,
    status: row.project.status as ProjectListItem["status"],
    dealId: row.project.dealId,
    dealTitle: row.dealTitle ?? null,
    ownerId: row.project.ownerId,
    ownerName: row.ownerName ?? row.project.ownerId,
    dueDate: row.project.dueDate,
    taskCount: byProject.get(row.project.id)?.total ?? 0,
    doneCount: byProject.get(row.project.id)?.done ?? 0,
  }));
}

export async function getProject(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<ProjectView, AppError>> {
  const visible = await loadVisibleProject(db, actor, id, signal);
  if (!visible.ok) return visible;
  return ok(await loadProjectView(db, visible.value));
}

export async function createProject(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<ProjectView, AppError>> {
  const parsed = createProjectInput.safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const input = parsed.data;
  signal.throwIfAborted();

  if (
    input.dealId != null &&
    !(await canActorAccessParent(db, actor, "deal", input.dealId, signal))
  ) {
    return err(notFound());
  }
  const ownerId = input.ownerId ?? actor.id;
  const [owner] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, ownerId));
  if (owner === undefined || !owner.isActive) {
    return err(invalidProjectInput("owner must be an active user"));
  }

  const created = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        name: input.name,
        description: input.description ?? null,
        dealId: input.dealId ?? null,
        organizationId: input.organizationId ?? null,
        personId: input.personId ?? null,
        ownerId,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
      })
      .returning();
    if (project === undefined) {
      throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "createProject: insert returned no rows");
    }
    const phaseNames = input.phases ?? [...PROJECT_DEFAULT_PHASES];
    await tx
      .insert(projectPhases)
      .values(phaseNames.map((name, position) => ({ projectId: project.id, name, position })));
    await emitDomainEvent(
      tx,
      { type: "project.created", entityType: "project", entityId: project.id, actorId: actor.id },
      signal,
    );
    return project;
  });
  return ok(await loadProjectView(db, created));
}

export async function updateProject(
  db: Db,
  actor: PermSetUser,
  id: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<ProjectView, AppError>> {
  const editable = await loadEditableProject(db, actor, id, signal);
  if (!editable.ok) return editable;
  const parsed = updateProjectInput.safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const input = parsed.data;
  if (
    input.dealId != null &&
    !(await canActorAccessParent(db, actor, "deal", input.dealId, signal))
  ) {
    return err(notFound());
  }

  const set: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.dealId !== undefined) set.dealId = input.dealId;
  if (input.organizationId !== undefined) set.organizationId = input.organizationId;
  if (input.personId !== undefined) set.personId = input.personId;
  if (input.ownerId !== undefined) set.ownerId = input.ownerId;
  if (input.startDate !== undefined) set.startDate = input.startDate;
  if (input.dueDate !== undefined) set.dueDate = input.dueDate;

  const [row] = await db.update(projects).set(set).where(eq(projects.id, id)).returning();
  if (row === undefined) return err(notFound());
  return ok(await loadProjectView(db, row));
}

export async function setProjectStatus(
  db: Db,
  actor: PermSetUser,
  id: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<ProjectView, AppError>> {
  const editable = await loadEditableProject(db, actor, id, signal);
  if (!editable.ok) return editable;
  const parsed = projectStatusSchema.safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const status = parsed.data;
  const old = editable.value.project.status;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(projects)
      .set({
        status,
        // Completing stamps the moment; any other status clears it (6.6).
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    if (row === undefined) {
      throw new AppError(ERROR_IDS.DB_INVARIANT, "setProjectStatus: update returned no rows");
    }
    if (old !== status) {
      await emitDomainEvent(
        tx,
        {
          type: "project.status_changed",
          entityType: "project",
          entityId: id,
          actorId: actor.id,
          changes: [{ field: "status", old, new: status }],
        },
        signal,
      );
    }
    return row;
  });
  return ok(await loadProjectView(db, updated));
}

export async function deleteProject(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  const editable = await loadEditableProject(db, actor, id, signal);
  if (!editable.ok) return editable;
  const row = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(projects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .returning({ id: projects.id });
    if (deleted === undefined) {
      throw new AppError(ERROR_IDS.DB_INVARIANT, "deleteProject: update returned no rows");
    }
    await emitDomainEvent(
      tx,
      { type: "project.deleted", entityType: "project", entityId: id, actorId: actor.id },
      signal,
    );
    return deleted;
  });
  return ok(row);
}
