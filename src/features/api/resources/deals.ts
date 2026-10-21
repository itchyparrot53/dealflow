import { type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { changeOwner } from "@/features/deal-workspace/changeOwner";
import { changeStage } from "@/features/deal-workspace/changeStage";
import { markLost, markWon, reopenDeal } from "@/features/deal-workspace/wonLost";
import { createDeal } from "@/features/deals/dealActions";
import { updateDeal } from "@/features/deals/dealUpdate";
import { deleteDeal } from "@/features/deals/deleteDeal";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import { setDealTerms } from "@/features/products/dealTerms";
import { decodeCursor, encodeCursor } from "../cursor";
import { createSession, day, iso } from "../shared";
import { type ApiPayload, type ApiRoute, payload } from "../types";

// Deals. Reads use the same visibility predicate as the board (so a token sees exactly what its
// user sees); writes go through the existing services, so change logs, board events and
// automations fire exactly as they do from the UI.

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  updated_since: z.string().datetime().optional(),
  pipelineId: z.uuid().optional(),
  stageId: z.uuid().optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  ownerId: z.uuid().optional(),
});

const decimal = z.string().regex(/^\d+(\.\d{1,2})?$/);

const createBody = z.object({
  title: z.string().trim().min(1).max(255),
  value: decimal.nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  pipelineId: z.uuid(),
  stageId: z.uuid(),
  personId: z.uuid().nullable().optional(),
  organizationId: z.uuid().nullable().optional(),
  ownerId: z.uuid().optional(),
  expectedCloseDate: z.string().date().nullable().optional(),
});

const updateBody = createBody.partial().extend({
  status: z.enum(["open", "won", "lost"]).optional(),
  lostReason: z.string().min(1).max(500).optional(),
  lostReasonId: z.uuid().optional(),
});

interface DealRow {
  id: string;
  title: string;
  status: string;
  value: string | null;
  currency: string;
  pipelineId: string;
  stageId: string;
  personId: string | null;
  organizationId: string | null;
  ownerId: string;
  expectedCloseDate: string | null;
  // Raw db.execute rows return timestamptz as a string; iso() accepts either.
  createdAt: Date | string;
  updatedAt: Date | string;
}

const SELECT = sql`
  SELECT d.id, d.title, d.status, d.value::text AS value,
    coalesce(dt.currency, (SELECT base_currency FROM settings WHERE id = true), 'USD') AS currency,
    d.pipeline_id AS "pipelineId", d.stage_id AS "stageId", d.person_id AS "personId",
    d.org_id AS "organizationId", d.owner_id AS "ownerId",
    d.expected_close_date AS "expectedCloseDate", d.created_at AS "createdAt",
    d.updated_at AS "updatedAt"
  FROM deals d
  JOIN pipelines p ON p.id = d.pipeline_id
  LEFT JOIN deal_terms dt ON dt.deal_id = d.id
`;

function view(row: DealRow): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    value: row.value,
    currency: row.currency,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    personId: row.personId,
    organizationId: row.organizationId,
    ownerId: row.ownerId,
    expectedCloseDate: day(row.expectedCloseDate),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function session(actor: PermSetUser) {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
  };
}

function invalidCursor(): AppError {
  return new AppError(ERROR_IDS.API_BODY_INVALID, "invalid cursor");
}

async function loadRow(db: Db, id: string, actor: PermSetUser): Promise<DealRow | null> {
  const result = await db.execute(
    sql`${SELECT} WHERE d.id = ${id} AND d.deleted_at IS NULL AND ${dealVisibilityClause(session(actor))}`,
  );
  return (result.rows[0] as unknown as DealRow | undefined) ?? null;
}

async function viewById(db: Db, id: string, actor: PermSetUser): Promise<ApiPayload> {
  const row = await loadRow(db, id, actor);
  return payload(row === null ? { id } : view(row));
}

type UpdateBody = z.infer<typeof updateBody>;

async function patchScalars(
  ctx: Parameters<NonNullable<ApiRoute["handler"]>>[0],
  id: string,
  parsed: UpdateBody,
  row: DealRow,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  const hasPlain =
    parsed.title !== undefined ||
    parsed.value !== undefined ||
    parsed.expectedCloseDate !== undefined ||
    parsed.personId !== undefined ||
    parsed.organizationId !== undefined;
  if (!hasPlain) return { ok: true };
  const plain = {
    dealId: id,
    expectedUpdatedAt: new Date(row.updatedAt).toISOString(),
    ...(parsed.title === undefined ? {} : { title: parsed.title }),
    ...(parsed.value === undefined || parsed.value === null ? {} : { value: Number(parsed.value) }),
    ...(parsed.expectedCloseDate === undefined
      ? {}
      : { expectedCloseDate: parsed.expectedCloseDate }),
    ...(parsed.personId === undefined ? {} : { personId: parsed.personId }),
    ...(parsed.organizationId === undefined ? {} : { orgId: parsed.organizationId }),
  };
  const updated = await updateDeal(ctx.db, ctx.actor, plain, signal);
  return updated.ok ? { ok: true } : { ok: false, error: updated.error };
}

async function patchStageOwner(
  ctx: Parameters<NonNullable<ApiRoute["handler"]>>[0],
  id: string,
  parsed: UpdateBody,
  row: DealRow,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  const expectedUpdatedAt = new Date(row.updatedAt).toISOString();
  if (parsed.stageId !== undefined && parsed.stageId !== row.stageId) {
    const moved = await changeStage(
      ctx.db,
      ctx.actor,
      { dealId: id, toStageId: parsed.stageId, expectedUpdatedAt },
      signal,
    );
    if (!moved.ok) return { ok: false, error: moved.error };
  }
  if (parsed.ownerId !== undefined && parsed.ownerId !== row.ownerId) {
    const owned = await changeOwner(
      ctx.db,
      ctx.actor,
      { dealId: id, ownerId: parsed.ownerId, expectedUpdatedAt },
      signal,
    );
    if (!owned.ok) return { ok: false, error: owned.error };
  }
  return { ok: true };
}

async function patchStatusCurrency(
  ctx: Parameters<NonNullable<ApiRoute["handler"]>>[0],
  id: string,
  parsed: UpdateBody,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  if (parsed.status === "won") {
    const won = await markWon(ctx.db, ctx.actor, id, signal);
    if (!won.ok) return { ok: false, error: won.error };
  } else if (parsed.status === "lost") {
    const lost = await markLost(
      ctx.db,
      ctx.actor,
      id,
      { lostReason: parsed.lostReason ?? null, lostReasonId: parsed.lostReasonId ?? null },
      signal,
    );
    if (!lost.ok) return { ok: false, error: lost.error };
  } else if (parsed.status === "open") {
    const reopened = await reopenDeal(ctx.db, ctx.actor, id, signal);
    if (!reopened.ok) return { ok: false, error: reopened.error };
  }
  if (parsed.currency !== undefined) {
    const terms = await setDealTerms(
      ctx.db,
      ctx.actor,
      { dealId: id, currency: parsed.currency.toUpperCase() },
      signal,
    );
    if (!terms.ok) return { ok: false, error: terms.error };
  }
  return { ok: true };
}

async function patchWorkflow(
  ctx: Parameters<NonNullable<ApiRoute["handler"]>>[0],
  id: string,
  parsed: UpdateBody,
  row: DealRow,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  const stageOwner = await patchStageOwner(ctx, id, parsed, row, signal);
  if (!stageOwner.ok) return stageOwner;
  return patchStatusCurrency(ctx, id, parsed, signal);
}

async function patchDeal(
  ctx: Parameters<NonNullable<ApiRoute["handler"]>>[0],
  id: string,
  parsed: UpdateBody,
  initial: DealRow,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  const scalars = await patchScalars(ctx, id, parsed, initial, signal);
  if (!scalars.ok) return scalars;
  const row = (await loadRow(ctx.db, id, ctx.actor)) ?? initial;
  return patchWorkflow(ctx, id, parsed, row, signal);
}

export const dealsRoutes: ApiRoute[] = [
  {
    resource: "deals",
    method: "GET",
    path: "/deals",
    scope: "read",
    summary: "List visible deals, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      const limit = q.limit ?? API_PAGE_DEFAULT;
      const clauses: SQL[] = [
        sql`d.deleted_at IS NULL`,
        sql`d.archived_at IS NULL`,
        sql`p.is_archived = false`,
        dealVisibilityClause(session(ctx.actor)),
      ];
      if (q.pipelineId !== undefined) clauses.push(sql`d.pipeline_id = ${q.pipelineId}`);
      if (q.stageId !== undefined) clauses.push(sql`d.stage_id = ${q.stageId}`);
      if (q.status !== undefined) clauses.push(sql`d.status = ${q.status}`);
      if (q.ownerId !== undefined) clauses.push(sql`d.owner_id = ${q.ownerId}`);
      if (q.updated_since !== undefined) {
        clauses.push(sql`d.updated_at >= ${q.updated_since}::timestamptz`);
      }
      if (q.cursor !== undefined) {
        const cursor = decodeCursor(q.cursor);
        if (!cursor.ok) return { ok: false, error: invalidCursor() };
        clauses.push(
          sql`(d.updated_at, d.id) > (${cursor.value.updatedAt}::timestamptz, ${cursor.value.id}::uuid)`,
        );
      }
      signal.throwIfAborted();
      const result = await ctx.db.execute(
        sql`${SELECT} WHERE ${sql.join(clauses, sql` AND `)} ORDER BY d.updated_at ASC, d.id ASC LIMIT ${limit + 1}`,
      );
      const rows = result.rows as unknown as DealRow[];
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      const nextCursor =
        rows.length > limit && last !== undefined
          ? encodeCursor({ updatedAt: new Date(last.updatedAt).toISOString(), id: last.id })
          : undefined;
      return { ok: true, value: payload(page.map(view), nextCursor) };
    },
    example: {
      request: "GET /api/v1/deals?limit=2",
      response: {
        data: [
          {
            id: "…",
            title: "Big deal",
            status: "open",
            value: "1500.00",
            currency: "USD",
            pipelineId: "…",
            stageId: "…",
            personId: null,
            organizationId: null,
            ownerId: "…",
            expectedCloseDate: "2026-12-01",
            createdAt: "2026-10-21T10:00:00.000Z",
            updatedAt: "2026-10-21T10:00:00.000Z",
          },
        ],
        nextCursor: "eyJ1cGRhdGVkQXQiOiIuLi4iLCJpZCI6Ii4uLiJ9",
      },
    },
  },
  {
    resource: "deals",
    method: "GET",
    path: "/deals/:id",
    scope: "read",
    summary: "Read one visible deal.",
    handler: async (ctx, params) => {
      const row = await loadRow(ctx.db, params.id ?? "", ctx.actor);
      if (row === null) {
        return { ok: false, error: new AppError(ERROR_IDS.DEAL_NOT_FOUND, "deal not found") };
      }
      return { ok: true, value: payload(view(row)) };
    },
    example: {
      request: "GET /api/v1/deals/{id}",
      response: { data: { id: "…", title: "Big deal" } },
    },
  },
  {
    resource: "deals",
    method: "POST",
    path: "/deals",
    scope: "write",
    summary: "Create a deal as the token's user.",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const created = await createDeal(
        ctx.db,
        await createSession(ctx.db, ctx.actor),
        {
          title: parsed.title,
          value: parsed.value === null || parsed.value === undefined ? null : Number(parsed.value),
          pipelineId: parsed.pipelineId,
          stageId: parsed.stageId,
          personId: parsed.personId ?? null,
          orgId: parsed.organizationId ?? null,
          ownerId: parsed.ownerId,
          expectedCloseDate: parsed.expectedCloseDate ?? null,
        },
        signal,
      );
      if (!created.ok) return created;
      if (parsed.currency !== undefined) {
        const terms = await setDealTerms(
          ctx.db,
          ctx.actor,
          { dealId: created.value.id, currency: parsed.currency.toUpperCase() },
          signal,
        );
        if (!terms.ok) return terms;
      }
      return { ok: true, value: await viewById(ctx.db, created.value.id, ctx.actor) };
    },
    example: {
      request: { title: "New deal", value: "1500.00", pipelineId: "…", stageId: "…" },
      response: { data: { id: "…", title: "New deal" } },
    },
  },
  {
    resource: "deals",
    method: "PATCH",
    path: "/deals/:id",
    scope: "write",
    summary: "Update a deal: plain fields, stage, owner and status go through their services.",
    body: updateBody,
    handler: async (ctx, params, _query, body, signal) => {
      const id = params.id ?? "";
      const parsed = updateBody.parse(body);
      const row = await loadRow(ctx.db, id, ctx.actor);
      if (row === null) {
        return { ok: false, error: new AppError(ERROR_IDS.DEAL_NOT_FOUND, "deal not found") };
      }
      const applied = await patchDeal(ctx, id, parsed, row, signal);
      if (!applied.ok) return applied;
      return { ok: true, value: await viewById(ctx.db, id, ctx.actor) };
    },
    example: { request: { stageId: "…" }, response: { data: { id: "…", stageId: "…" } } },
  },
  {
    resource: "deals",
    method: "DELETE",
    path: "/deals/:id",
    scope: "write",
    summary: "Soft-delete a deal (the recycle bin can restore it).",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await deleteDeal(ctx.db, ctx.actor, params.id ?? "", signal);
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: result.value.id }) };
    },
    example: { request: "DELETE /api/v1/deals/{id}", response: { data: { id: "…" } } },
  },
];

// Keeps the query type exported for the handler's generic parse and for tests.
export type DealListQuery = z.infer<typeof listQuery>;
