import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { activities } from "@/db/schema";
import { deleteActivity } from "@/features/activities/activityDelete";
import { updateActivity } from "@/features/activities/activityUpdate";
import { completeActivity, createActivity } from "@/features/activities/repo";
import type { ActivityCreateInput, ActivityUpdateInput } from "@/features/activities/schemas";
import { resolveActivityVisibility } from "@/features/activities/visibility";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import { scanVisiblePage } from "../listScan";
import { iso } from "../shared";
import { type ApiRoute, payload } from "../types";

// Activities. Visibility resolves through the dominant parent (deal > person > organization >
// parentless), the same helper the activity detail and completion paths use, so a token never
// reads an activity its user cannot open.

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  updated_since: z.string().datetime().optional(),
  dealId: z.uuid().optional(),
  personId: z.uuid().optional(),
  assigneeId: z.uuid().optional(),
  done: z.enum(["true", "false"]).optional(),
});

const writeBody = z.object({
  typeId: z.uuid().optional(),
  subject: z.string().trim().min(1).max(255).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  assigneeId: z.uuid().optional(),
  dealId: z.uuid().nullable().optional(),
  personId: z.uuid().nullable().optional(),
  organizationId: z.uuid().nullable().optional(),
  note: z.string().max(50_000).nullable().optional(),
  done: z.boolean().optional(),
});

const createBody = writeBody.extend({
  typeId: z.uuid(),
  subject: z.string().trim().min(1).max(255),
});

type ActivityRow = typeof activities.$inferSelect;

function view(row: ActivityRow): Record<string, unknown> {
  return {
    id: row.id,
    typeId: row.typeId,
    subject: row.subject,
    dueAt: iso(row.dueAt),
    endAt: iso(row.endAt),
    durationMinutes: row.durationMinutes,
    assigneeId: row.assigneeId,
    dealId: row.dealId,
    personId: row.personId,
    organizationId: row.orgId,
    note: row.note,
    done: row.done,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function visibleRow(
  db: Db,
  actor: PermSetUser,
  row: ActivityRow,
  signal: AbortSignal,
): Promise<boolean> {
  const visible = await resolveActivityVisibility(db, row, signal);
  return visible !== null && canSee(actor, visible);
}

export const activitiesRoutes: ApiRoute[] = [
  {
    resource: "activities",
    method: "GET",
    path: "/activities",
    scope: "read",
    summary: "List visible activities, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      const limit = q.limit ?? API_PAGE_DEFAULT;
      const clauses: SQL[] = [isNull(activities.deletedAt)];
      if (q.dealId !== undefined) clauses.push(eq(activities.dealId, q.dealId));
      if (q.personId !== undefined) clauses.push(eq(activities.personId, q.personId));
      if (q.assigneeId !== undefined) clauses.push(eq(activities.assigneeId, q.assigneeId));
      if (q.done !== undefined) clauses.push(eq(activities.done, q.done === "true"));
      if (q.updated_since !== undefined) {
        clauses.push(sql`${activities.updatedAt} >= ${q.updated_since}::timestamptz`);
      }
      const baseClauses = clauses;
      const scanned = await scanVisiblePage<ActivityRow>(
        ({ after, size }) => {
          const batchClauses = [...baseClauses];
          if (after !== null) {
            batchClauses.push(
              sql`(${activities.updatedAt}, ${activities.id}) > (${after.updatedAt}::timestamptz, ${after.id}::uuid)`,
            );
          }
          return ctx.db
            .select()
            .from(activities)
            .where(and(...batchClauses))
            .orderBy(sql`${activities.updatedAt} ASC, ${activities.id} ASC`)
            .limit(size);
        },
        (row) => visibleRow(ctx.db, ctx.actor, row, signal),
        q.cursor,
        limit,
      );
      if (!scanned.ok) {
        return { ok: false, error: new AppError(ERROR_IDS.API_BODY_INVALID, "invalid cursor") };
      }
      return { ok: true, value: payload(scanned.rows.map(view), scanned.nextCursor) };
    },
    example: {
      request: "GET /api/v1/activities?dealId={dealId}",
      response: { data: [{ id: "…", subject: "Call", done: false }] },
    },
  },
  {
    resource: "activities",
    method: "GET",
    path: "/activities/:id",
    scope: "read",
    summary: "Read one visible activity.",
    handler: async (ctx, params) => {
      const [row] = await ctx.db
        .select()
        .from(activities)
        .where(and(eq(activities.id, params.id ?? ""), isNull(activities.deletedAt)));
      if (
        row === undefined ||
        !(await visibleRow(ctx.db, ctx.actor, row, AbortSignal.timeout(10_000)))
      ) {
        return {
          ok: false,
          error: new AppError(ERROR_IDS.ACTIVITY_NOT_FOUND, "activity not found"),
        };
      }
      return { ok: true, value: payload(view(row)) };
    },
    example: { request: "GET /api/v1/activities/{id}", response: { data: { id: "…" } } },
  },
  {
    resource: "activities",
    method: "POST",
    path: "/activities",
    scope: "write",
    summary: "Create an activity as the token's user.",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const input: ActivityCreateInput = {
        typeId: parsed.typeId,
        subject: parsed.subject,
        priority: null,
        allDay: false,
        dueAt: parsed.dueAt ?? null,
        endAt: parsed.endAt ?? null,
        durationMinutes: parsed.durationMinutes ?? null,
        dealId: parsed.dealId ?? null,
        leadId: null,
        personId: parsed.personId ?? null,
        orgId: parsed.organizationId ?? null,
        ...(parsed.assigneeId === undefined ? {} : { assigneeId: parsed.assigneeId }),
        guestPersonIds: [],
        participantUserIds: [],
        customFields: {},
        note: parsed.note ?? null,
        location: null,
        videoCallUrl: null,
        done: parsed.done ?? false,
      };
      const result = await createActivity(ctx.db, ctx.actor, input, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: {
      request: { typeId: "…", subject: "Call", dealId: "…" },
      response: { data: { id: "…", subject: "Call" } },
    },
  },
  {
    resource: "activities",
    method: "PATCH",
    path: "/activities/:id",
    scope: "write",
    summary: "Update an activity; flipping done goes through completeActivity.",
    body: writeBody,
    handler: async (ctx, params, _query, body, signal) => {
      const id = params.id ?? "";
      const parsed = writeBody.parse(body);
      const input: ActivityUpdateInput = {
        id,
        ...(parsed.typeId === undefined ? {} : { typeId: parsed.typeId }),
        ...(parsed.subject === undefined ? {} : { subject: parsed.subject }),
        ...(parsed.dueAt === undefined ? {} : { dueAt: parsed.dueAt }),
        ...(parsed.endAt === undefined ? {} : { endAt: parsed.endAt }),
        ...(parsed.durationMinutes === undefined
          ? {}
          : { durationMinutes: parsed.durationMinutes }),
        ...(parsed.assigneeId === undefined ? {} : { assigneeId: parsed.assigneeId }),
        ...(parsed.note === undefined ? {} : { note: parsed.note }),
        ...(parsed.dealId === undefined ? {} : { dealId: parsed.dealId }),
        ...(parsed.personId === undefined ? {} : { personId: parsed.personId }),
        ...(parsed.organizationId === undefined ? {} : { orgId: parsed.organizationId }),
      };
      const updated = await updateActivity(ctx.db, ctx.actor, input, signal);
      if (!updated.ok) return updated;
      if (parsed.done !== undefined && parsed.done !== updated.value.done) {
        const done = await completeActivity(ctx.db, ctx.actor, id, parsed.done, signal);
        if (!done.ok) return done;
        return { ok: true, value: payload(view(done.value)) };
      }
      return { ok: true, value: payload(view(updated.value)) };
    },
    example: { request: { done: true }, response: { data: { id: "…", done: true } } },
  },
  {
    resource: "activities",
    method: "DELETE",
    path: "/activities/:id",
    scope: "write",
    summary: "Soft-delete an activity.",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await deleteActivity(ctx.db, ctx.actor, params.id ?? "", signal);
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: params.id ?? "" }) };
    },
    example: { request: "DELETE /api/v1/activities/{id}", response: { data: { id: "…" } } },
  },
];
