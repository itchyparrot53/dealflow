import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  projectStatusSchema,
  setProjectStatus,
  updateProject,
} from "@/features/projects/projects";
import { addTask, completeTask, moveTask, reopenTask, updateTask } from "@/features/projects/tasks";
import type { ProjectView } from "@/features/projects/types";
import { decodeCursor, encodeCursor } from "../cursor";
import { type ApiRoute, payload } from "../types";

// Projects and their tasks. Every handler calls the projects service, so the deal-linked
// visibility rule and the owner/assignee/admin edit rule apply exactly as in the UI.

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  status: projectStatusSchema.optional(),
  dealId: z.uuid().optional(),
});

const createBody = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000).nullable().optional(),
  dealId: z.uuid().nullable().optional(),
  organizationId: z.uuid().nullable().optional(),
  personId: z.uuid().nullable().optional(),
  ownerId: z.uuid().optional(),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  phases: z.array(z.string().trim().min(1).max(80)).min(1).max(10).optional(),
});

const updateBody = createBody.partial().extend({ status: projectStatusSchema.optional() });

const taskBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  phaseId: z.uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  done: z.boolean().optional(),
});

const createTaskBody = taskBody.extend({ title: z.string().trim().min(1).max(200) });

function view(project: ProjectView): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    dealId: project.dealId,
    dealTitle: project.dealTitle,
    organizationId: project.organizationId,
    personId: project.personId,
    ownerId: project.ownerId,
    startDate: project.startDate,
    dueDate: project.dueDate,
    completedAt: project.completedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    phases: project.phases,
    tasks: project.tasks,
    taskCount: project.taskCount,
    doneCount: project.doneCount,
  };
}

async function reload(id: string, ctx: Parameters<NonNullable<ApiRoute["handler"]>>[0]) {
  const result = await getProject(ctx.db, ctx.actor, id, AbortSignal.timeout(15_000));
  if (!result.ok) return result;
  return { ok: true as const, value: payload(view(result.value)) };
}

export const projectsRoutes: ApiRoute[] = [
  {
    resource: "projects",
    method: "GET",
    path: "/projects",
    scope: "read",
    summary: "List visible projects, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      const limit = q.limit ?? API_PAGE_DEFAULT;
      const all = await listProjects(
        ctx.db,
        ctx.actor,
        {
          ...(q.status === undefined ? {} : { status: q.status }),
          ...(q.dealId === undefined ? {} : { dealId: q.dealId }),
        },
        signal,
      );
      const sorted = [...all].sort((a, b) =>
        a.updatedAt === b.updatedAt
          ? a.id.localeCompare(b.id)
          : a.updatedAt.localeCompare(b.updatedAt),
      );
      let start = 0;
      if (q.cursor !== undefined) {
        const cursor = decodeCursor(q.cursor);
        if (!cursor.ok) {
          return { ok: false, error: new AppError(ERROR_IDS.API_BODY_INVALID, "invalid cursor") };
        }
        start = sorted.findIndex(
          (row) =>
            row.updatedAt > cursor.value.updatedAt ||
            (row.updatedAt === cursor.value.updatedAt && row.id > cursor.value.id),
        );
        if (start < 0) start = sorted.length;
      }
      const page = sorted.slice(start, start + limit);
      const last = page[page.length - 1];
      const nextCursor =
        start + limit < sorted.length && last !== undefined
          ? encodeCursor({ updatedAt: last.updatedAt, id: last.id })
          : undefined;
      return {
        ok: true,
        value: payload(
          page.map((row) => ({
            id: row.id,
            name: row.name,
            status: row.status,
            dealId: row.dealId,
            dealTitle: row.dealTitle,
            ownerId: row.ownerId,
            dueDate: row.dueDate,
            taskCount: row.taskCount,
            doneCount: row.doneCount,
            updatedAt: row.updatedAt,
          })),
          nextCursor,
        ),
      };
    },
    example: {
      request: "GET /api/v1/projects?status=active",
      response: { data: [{ id: "…", name: "Launch", status: "active" }] },
    },
  },
  {
    resource: "projects",
    method: "GET",
    path: "/projects/:id",
    scope: "read",
    summary: "Read one visible project with its phases and tasks.",
    handler: async (ctx, params) => reload(params.id ?? "", ctx),
    example: { request: "GET /api/v1/projects/{id}", response: { data: { id: "…" } } },
  },
  {
    resource: "projects",
    method: "POST",
    path: "/projects",
    scope: "write",
    summary: "Create a project with the default phases unless `phases` is supplied.",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const result = await createProject(ctx.db, ctx.actor, parsed, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: { request: { name: "Launch" }, response: { data: { id: "…", name: "Launch" } } },
  },
  {
    resource: "projects",
    method: "PATCH",
    path: "/projects/:id",
    scope: "write",
    summary: "Update a project; `status` goes through setProjectStatus.",
    body: updateBody,
    handler: async (ctx, params, _query, body, signal) => {
      const id = params.id ?? "";
      const parsed = updateBody.parse(body);
      const { status, ...rest } = parsed;
      if (Object.keys(rest).length > 0) {
        const updated = await updateProject(ctx.db, ctx.actor, id, rest, signal);
        if (!updated.ok) return updated;
      }
      if (status !== undefined) {
        const changed = await setProjectStatus(ctx.db, ctx.actor, id, status, signal);
        if (!changed.ok) return changed;
      }
      return reload(id, ctx);
    },
    example: { request: { status: "completed" }, response: { data: { id: "…" } } },
  },
  {
    resource: "projects",
    method: "DELETE",
    path: "/projects/:id",
    scope: "write",
    summary: "Soft-delete a project (the recycle bin can restore it).",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await deleteProject(ctx.db, ctx.actor, params.id ?? "", signal);
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: result.value.id }) };
    },
    example: { request: "DELETE /api/v1/projects/{id}", response: { data: { id: "…" } } },
  },
  {
    resource: "projects",
    method: "GET",
    path: "/projects/:id/tasks",
    scope: "read",
    summary: "List a project's tasks.",
    handler: async (ctx, params) => {
      const result = await getProject(
        ctx.db,
        ctx.actor,
        params.id ?? "",
        AbortSignal.timeout(15_000),
      );
      if (!result.ok) return result;
      return { ok: true, value: payload(result.value.tasks) };
    },
    example: { request: "GET /api/v1/projects/{id}/tasks", response: { data: [{ id: "…" }] } },
  },
  {
    resource: "projects",
    method: "POST",
    path: "/projects/:id/tasks",
    scope: "write",
    summary: "Add a task to a project.",
    body: createTaskBody,
    handler: async (ctx, params, _query, body, signal) => {
      const parsed = createTaskBody.parse(body);
      const result = await addTask(ctx.db, ctx.actor, params.id ?? "", parsed, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(result.value) };
    },
    example: {
      request: { title: "Write the brief", phaseId: "…" },
      response: { data: { id: "…", title: "Write the brief" } },
    },
  },
  {
    resource: "projects",
    method: "PATCH",
    path: "/projects/:id/tasks/:taskId",
    scope: "write",
    summary: "Update a task; `phaseId` moves it and `done` completes or reopens it.",
    body: taskBody,
    handler: async (ctx, params, _query, body, signal) => {
      const projectId = params.id ?? "";
      const taskId = params.taskId ?? "";
      const parsed = taskBody.parse(body);
      const { phaseId, position, done, ...fields } = parsed;
      if (Object.keys(fields).length > 0) {
        const updated = await updateTask(
          ctx.db,
          ctx.actor,
          projectId,
          { taskId, ...fields },
          signal,
        );
        if (!updated.ok) return updated;
      }
      if (phaseId !== undefined) {
        const moved = await moveTask(
          ctx.db,
          ctx.actor,
          projectId,
          { taskId, phaseId, position: position ?? 10_000 },
          signal,
        );
        if (!moved.ok) return moved;
      }
      if (done !== undefined) {
        const changed = done
          ? await completeTask(ctx.db, ctx.actor, projectId, { taskId }, signal)
          : await reopenTask(ctx.db, ctx.actor, projectId, { taskId }, signal);
        if (!changed.ok) return changed;
        return { ok: true, value: payload(changed.value) };
      }
      const view = await getProject(ctx.db, ctx.actor, projectId, AbortSignal.timeout(15_000));
      if (!view.ok) return view;
      const task = view.value.tasks.find((row) => row.id === taskId);
      if (task === undefined) {
        return {
          ok: false,
          error: new AppError(ERROR_IDS.PROJECT_TASK_NOT_FOUND, "task not found"),
        };
      }
      return { ok: true, value: payload(task) };
    },
    example: { request: { done: true }, response: { data: { id: "…", done: true } } },
  },
];
