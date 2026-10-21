import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { projectPhases, projectTasks, users } from "@/db/schema";
import { emitDomainEvent } from "@/features/events/emit";
import { createNotification } from "@/features/notifications/produce";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { invalidProjectInput } from "./projects";
import type { TaskView } from "./types";
import { loadEditableProject } from "./visibility";

// Project tasks. Every mutation checks the project edit rule (owner, assignee or admin) and the
// task's membership of that project, so a task id from another project cannot be edited.

const titleInput = z.string().trim().min(1).max(200);
const descriptionInput = z.string().max(5000).nullable().optional();
const dateInput = z.string().date().nullable().optional();

function notFound(projectId: string): AppError {
  return new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "task not found", { projectId });
}

async function loadTask(
  db: Db,
  projectId: string,
  taskId: string,
): Promise<typeof projectTasks.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(projectTasks)
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId)));
  return row ?? null;
}

async function taskView(db: Db, row: typeof projectTasks.$inferSelect): Promise<TaskView> {
  const [assignee] =
    row.assigneeId === null
      ? []
      : await db.select({ name: users.name }).from(users).where(eq(users.id, row.assigneeId));
  return {
    id: row.id,
    projectId: row.projectId,
    phaseId: row.phaseId,
    title: row.title,
    description: row.description,
    assigneeId: row.assigneeId,
    assigneeName: assignee?.name ?? null,
    dueDate: row.dueDate,
    done: row.done,
    doneAt: row.doneAt?.toISOString() ?? null,
    position: row.position,
  };
}

async function phaseGuard(db: Db, projectId: string, phaseId: string | null): Promise<boolean> {
  if (phaseId === null) return true;
  const [row] = await db
    .select({ id: projectPhases.id })
    .from(projectPhases)
    .where(and(eq(projectPhases.id, phaseId), eq(projectPhases.projectId, projectId)));
  return row !== undefined;
}

async function requireActiveUser(db: Db, userId: string | null): Promise<boolean> {
  if (userId === null) return true;
  const [row] = await db
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId));
  return row?.isActive === true;
}

async function nextPosition(db: Db, projectId: string, phaseId: string | null): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${projectTasks.position}), -1) + 1` })
    .from(projectTasks)
    .where(
      and(
        eq(projectTasks.projectId, projectId),
        phaseId === null ? isNull(projectTasks.phaseId) : eq(projectTasks.phaseId, phaseId),
      ),
    );
  return row?.next ?? 0;
}

// Best-effort, after the task commit: a notification failure must not undo the assignment.
async function notifyAssigned(
  db: Db,
  actor: PermSetUser,
  project: { id: string; name: string },
  task: { id: string; title: string; assigneeId: string | null },
  signal: AbortSignal,
): Promise<void> {
  if (task.assigneeId === null || task.assigneeId === actor.id) return;
  try {
    const result = await createNotification(
      db,
      {
        recipientId: task.assigneeId,
        type: "project_task_assigned",
        entityType: "project",
        entityId: project.id,
        actorId: actor.id,
        payload: {
          projectId: project.id,
          projectName: project.name,
          taskId: task.id,
          taskTitle: task.title,
        },
      },
      signal,
    );
    if (!result.ok) {
      console.warn("notifyAssigned: notification failed (best-effort)", { id: result.error.id });
    }
  } catch (error) {
    console.warn("notifyAssigned: notification failed (best-effort)", { error });
  }
}

export async function addTask(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<TaskView, AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z
    .object({
      phaseId: z.uuid().nullable().optional(),
      title: titleInput,
      description: descriptionInput,
      assigneeId: z.uuid().nullable().optional(),
      dueDate: dateInput,
    })
    .safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const input = parsed.data;
  const phaseId = input.phaseId ?? null;
  const assigneeId = input.assigneeId ?? null;
  if (!(await phaseGuard(db, projectId, phaseId))) {
    return err(
      new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "phase not in project", { projectId }),
    );
  }
  if (!(await requireActiveUser(db, assigneeId))) {
    return err(invalidProjectInput("assignee must be an active user"));
  }

  const [row] = await db
    .insert(projectTasks)
    .values({
      projectId,
      phaseId,
      title: input.title,
      description: input.description ?? null,
      assigneeId,
      dueDate: input.dueDate ?? null,
      position: await nextPosition(db, projectId, phaseId),
    })
    .returning();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "addTask: insert returned no rows");
  }
  await notifyAssigned(db, actor, editable.value.project, row, signal);
  return ok(await taskView(db, row));
}

export async function updateTask(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<TaskView, AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z
    .object({
      taskId: z.uuid(),
      title: titleInput.optional(),
      description: descriptionInput,
      assigneeId: z.uuid().nullable().optional(),
      dueDate: dateInput,
    })
    .safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const existing = await loadTask(db, projectId, parsed.data.taskId);
  if (existing === null) return err(notFound(projectId));
  if (!(await requireActiveUser(db, parsed.data.assigneeId ?? null))) {
    return err(invalidProjectInput("assignee must be an active user"));
  }

  const set: Partial<typeof projectTasks.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) set.title = parsed.data.title;
  if (parsed.data.description !== undefined) set.description = parsed.data.description;
  if (parsed.data.assigneeId !== undefined) set.assigneeId = parsed.data.assigneeId;
  if (parsed.data.dueDate !== undefined) set.dueDate = parsed.data.dueDate;

  const [row] = await db
    .update(projectTasks)
    .set(set)
    .where(and(eq(projectTasks.id, existing.id), eq(projectTasks.projectId, projectId)))
    .returning();
  if (row === undefined) return err(notFound(projectId));
  if (row.assigneeId !== existing.assigneeId) {
    await notifyAssigned(db, actor, editable.value.project, row, signal);
  }
  return ok(await taskView(db, row));
}

export async function moveTask(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<TaskView[], AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z
    .object({ taskId: z.uuid(), phaseId: z.uuid().nullable(), position: z.number().int().min(0) })
    .safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const target = parsed.data.phaseId;
  const existing = await loadTask(db, projectId, parsed.data.taskId);
  if (existing === null) return err(notFound(projectId));
  if (!(await phaseGuard(db, projectId, target))) {
    return err(
      new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "phase not in project", { projectId }),
    );
  }

  await db.transaction(async (tx) => {
    const peers = await tx
      .select({ id: projectTasks.id })
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.projectId, projectId),
          target === null ? isNull(projectTasks.phaseId) : eq(projectTasks.phaseId, target),
          sql`${projectTasks.id} <> ${existing.id}::uuid`,
        ),
      )
      .orderBy(asc(projectTasks.position), asc(projectTasks.createdAt));
    const ordered = peers.map((peer) => peer.id);
    ordered.splice(Math.min(parsed.data.position, ordered.length), 0, existing.id);

    // Renumber the whole target column so positions stay dense (the board renders this order).
    for (const [position, id] of ordered.entries()) {
      await tx
        .update(projectTasks)
        .set({ position, phaseId: target, updatedAt: new Date() })
        .where(eq(projectTasks.id, id));
    }

    // A cross-phase move also leaves a gap in the source column, so renumber that one too.
    if (existing.phaseId !== target) {
      const source = await tx
        .select({ id: projectTasks.id })
        .from(projectTasks)
        .where(
          and(
            eq(projectTasks.projectId, projectId),
            existing.phaseId === null
              ? isNull(projectTasks.phaseId)
              : eq(projectTasks.phaseId, existing.phaseId),
          ),
        )
        .orderBy(asc(projectTasks.position), asc(projectTasks.createdAt));
      for (const [position, peer] of source.entries()) {
        await tx
          .update(projectTasks)
          .set({ position, updatedAt: new Date() })
          .where(eq(projectTasks.id, peer.id));
      }
    }
  });

  const rows = await db
    .select()
    .from(projectTasks)
    .where(eq(projectTasks.projectId, projectId))
    .orderBy(asc(projectTasks.position), asc(projectTasks.createdAt));
  return ok(await Promise.all(rows.map((row) => taskView(db, row))));
}

export async function setTaskDone(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  done: boolean,
  signal: AbortSignal,
): Promise<Result<TaskView, AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z.object({ taskId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const existing = await loadTask(db, projectId, parsed.data.taskId);
  if (existing === null) return err(notFound(projectId));

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projectTasks)
      .set({ done, doneAt: done ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(projectTasks.id, existing.id), eq(projectTasks.projectId, projectId)))
      .returning();
    if (updated === undefined) {
      throw new AppError(ERROR_IDS.DB_INVARIANT, "setTaskDone: update returned no rows");
    }
    if (done && !existing.done) {
      await emitDomainEvent(
        tx,
        {
          type: "project_task.completed",
          entityType: "project",
          entityId: projectId,
          actorId: actor.id,
          changes: [{ field: "task", old: null, new: updated.id }],
        },
        signal,
      );
    }
    return updated;
  });
  return ok(await taskView(db, row));
}

export async function completeTask(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<TaskView, AppError>> {
  return setTaskDone(db, actor, projectId, raw, true, signal);
}

export async function reopenTask(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<TaskView, AppError>> {
  return setTaskDone(db, actor, projectId, raw, false, signal);
}

export async function deleteTask(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z.object({ taskId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));
  const [row] = await db
    .delete(projectTasks)
    .where(and(eq(projectTasks.id, parsed.data.taskId), eq(projectTasks.projectId, projectId)))
    .returning({ id: projectTasks.id });
  if (row === undefined) return err(notFound(projectId));
  return ok(row);
}
