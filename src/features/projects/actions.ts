"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { addPhase, deletePhase, movePhase, renamePhase } from "./phases";
import { createProject, deleteProject, setProjectStatus, updateProject } from "./projects";
import { addTask, completeTask, deleteTask, moveTask, reopenTask, updateTask } from "./tasks";

// Project mutations. CSRF and the session live here; the services own the visibility and
// owner/assignee/admin rules. Reads are tRPC procedures in router.ts.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createProjectAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createProject(db, g.value, input, SIG()));
}

export async function updateProjectAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateProject(db, g.value, id, input, SIG()));
}

export async function setProjectStatusAction(
  id: string,
  status: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setProjectStatus(db, g.value, id, status, SIG()));
}

export async function deleteProjectAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteProject(db, g.value, id, SIG()));
}

export async function addPhaseAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await addPhase(db, g.value, projectId, input, SIG()));
}

export async function renamePhaseAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await renamePhase(db, g.value, projectId, input, SIG()));
}

export async function movePhaseAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await movePhase(db, g.value, projectId, input, SIG()));
}

export async function deletePhaseAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deletePhase(db, g.value, projectId, input, SIG()));
}

export async function addTaskAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await addTask(db, g.value, projectId, input, SIG()));
}

export async function updateTaskAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateTask(db, g.value, projectId, input, SIG()));
}

export async function moveTaskAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await moveTask(db, g.value, projectId, input, SIG()));
}

export async function completeTaskAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await completeTask(db, g.value, projectId, input, SIG()));
}

export async function reopenTaskAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<unknown>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await reopenTask(db, g.value, projectId, input, SIG()));
}

export async function deleteTaskAction(
  projectId: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteTask(db, g.value, projectId, input, SIG()));
}
