import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { projectPhases } from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { invalidProjectInput } from "./projects";
import type { PhaseView } from "./types";
import { loadEditableProject } from "./visibility";

// Project phases. Deleting one leaves its tasks in the board's "No phase" column (the task FK is
// ON DELETE SET NULL); the other three operations renumber positions so the board order is dense.

const nameInput = z.string().trim().min(1).max(80);

export async function loadPhases(db: Db, projectId: string): Promise<PhaseView[]> {
  const rows = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
    .orderBy(asc(projectPhases.position), asc(projectPhases.id));
  return rows.map((row) => ({ id: row.id, name: row.name, position: row.position }));
}

export async function addPhase(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<PhaseView[], AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z.object({ name: nameInput }).safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));

  const [max] = await db
    .select({ next: sql<number>`coalesce(max(${projectPhases.position}), -1) + 1` })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId));
  await db
    .insert(projectPhases)
    .values({ projectId, name: parsed.data.name, position: max?.next ?? 0 });
  return ok(await loadPhases(db, projectId));
}

export async function renamePhase(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<PhaseView[], AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z.object({ phaseId: z.uuid(), name: nameInput }).safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));

  const [row] = await db
    .update(projectPhases)
    .set({ name: parsed.data.name })
    .where(and(eq(projectPhases.id, parsed.data.phaseId), eq(projectPhases.projectId, projectId)))
    .returning({ id: projectPhases.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "phase not found", { projectId }));
  }
  return ok(await loadPhases(db, projectId));
}

export async function movePhase(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<PhaseView[], AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z
    .object({ phaseId: z.uuid(), position: z.number().int().min(0).max(1000) })
    .safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));

  const phases = await loadPhases(db, projectId);
  const from = phases.findIndex((phase) => phase.id === parsed.data.phaseId);
  if (from === -1) {
    return err(new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "phase not found", { projectId }));
  }
  const ordered = [...phases];
  const [moved] = ordered.splice(from, 1);
  if (moved === undefined) return err(invalidProjectInput("phase disappeared"));
  ordered.splice(Math.min(parsed.data.position, ordered.length), 0, moved);

  await db.transaction(async (tx) => {
    for (const [position, phase] of ordered.entries()) {
      await tx
        .update(projectPhases)
        .set({ position })
        .where(and(eq(projectPhases.id, phase.id), eq(projectPhases.projectId, projectId)));
    }
  });
  return ok(await loadPhases(db, projectId));
}

export async function deletePhase(
  db: Db,
  actor: PermSetUser,
  projectId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<PhaseView[], AppError>> {
  const editable = await loadEditableProject(db, actor, projectId, signal);
  if (!editable.ok) return editable;
  const parsed = z.object({ phaseId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return err(invalidProjectInput(parsed.error.issues));

  const [row] = await db
    .delete(projectPhases)
    .where(and(eq(projectPhases.id, parsed.data.phaseId), eq(projectPhases.projectId, projectId)))
    .returning({ id: projectPhases.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "phase not found", { projectId }));
  }
  return ok(await loadPhases(db, projectId));
}
