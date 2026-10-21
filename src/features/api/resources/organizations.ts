import { and, isNull, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { organizations } from "@/db/schema";
import { deleteOrg } from "@/features/contacts/deleteOrg";
import { createOrg, getOrg, toVisibleRecord, updateOrg } from "@/features/contacts/orgsRepo";
import type { OrgCreateInput, OrgUpdateInput } from "@/features/contacts/schemas";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { scanVisiblePage } from "../listScan";
import { contactActor, iso } from "../shared";
import { type ApiRoute, payload } from "../types";

// Organizations. Same visibility and service path as the Organizations list and detail page.

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postal: z.string().optional(),
  country: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  updated_since: z.string().datetime().optional(),
  search: z.string().trim().max(200).optional(),
});

const writeBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  address: addressSchema.nullable().optional(),
  ownerId: z.uuid().optional(),
});

const createBody = writeBody.extend({ name: z.string().trim().min(1).max(255) });

type OrgRow = typeof organizations.$inferSelect;

function view(row: OrgRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    ownerId: row.ownerId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function page(
  db: Db,
  actor: PermSetUser,
  q: z.infer<typeof listQuery>,
): Promise<Result<{ rows: OrgRow[]; nextCursor?: string }, AppError>> {
  const limit = q.limit ?? API_PAGE_DEFAULT;
  const scanned = await scanVisiblePage<OrgRow>(
    ({ after, size }) => {
      const clauses: SQL[] = [isNull(organizations.deletedAt)];
      if (q.search !== undefined && q.search !== "") {
        const pattern = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
        clauses.push(sql`${organizations.name} ILIKE ${pattern}`);
      }
      if (q.updated_since !== undefined) {
        clauses.push(sql`${organizations.updatedAt} >= ${q.updated_since}::timestamptz`);
      }
      if (after !== null) {
        clauses.push(
          sql`(${organizations.updatedAt}, ${organizations.id}) > (${after.updatedAt}::timestamptz, ${after.id}::uuid)`,
        );
      }
      return db
        .select()
        .from(organizations)
        .where(and(...clauses))
        .orderBy(sql`${organizations.updatedAt} ASC, ${organizations.id} ASC`)
        .limit(size);
    },
    (row) => canSee(actor, toVisibleRecord(row)),
    q.cursor,
    limit,
  );
  if (!scanned.ok) {
    return err(new AppError(ERROR_IDS.API_BODY_INVALID, "invalid cursor"));
  }
  return ok({ rows: scanned.rows, nextCursor: scanned.nextCursor });
}

export const organizationsRoutes: ApiRoute[] = [
  {
    resource: "organizations",
    method: "GET",
    path: "/organizations",
    scope: "read",
    summary: "List visible organizations, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      signal.throwIfAborted();
      const result = await page(ctx.db, ctx.actor, q);
      if (!result.ok) return result;
      return { ok: true, value: payload(result.value.rows.map(view), result.value.nextCursor) };
    },
    example: {
      request: "GET /api/v1/organizations?search=acme",
      response: { data: [{ id: "…", name: "Acme", address: null }] },
    },
  },
  {
    resource: "organizations",
    method: "GET",
    path: "/organizations/:id",
    scope: "read",
    summary: "Read one visible organization.",
    handler: async (ctx, params) => {
      const actor = await contactActor(ctx.db, ctx.actor);
      const row = await getOrg(ctx.db, actor, params.id ?? "", AbortSignal.timeout(10_000));
      if (!row.ok) return row;
      if (!canSee(ctx.actor, toVisibleRecord(row.value))) {
        return {
          ok: false,
          error: new AppError(ERROR_IDS.CONTACT_NOT_FOUND, "organization not found"),
        };
      }
      return { ok: true, value: payload(view(row.value)) };
    },
    example: { request: "GET /api/v1/organizations/{id}", response: { data: { id: "…" } } },
  },
  {
    resource: "organizations",
    method: "POST",
    path: "/organizations",
    scope: "write",
    summary: "Create an organization as the token's user.",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const input: OrgCreateInput = {
        name: parsed.name,
        address: parsed.address ?? null,
        customFields: {},
      };
      const actor = await contactActor(ctx.db, ctx.actor);
      const result = await createOrg(ctx.db, actor, input, signal);
      if (!result.ok) return result;
      if (parsed.ownerId !== undefined && parsed.ownerId !== result.value.ownerId) {
        const owned = await updateOrg(
          ctx.db,
          actor,
          { id: result.value.id, ownerId: parsed.ownerId },
          signal,
        );
        if (!owned.ok) return owned;
        return { ok: true, value: payload(view(owned.value)) };
      }
      return { ok: true, value: payload(view(result.value)) };
    },
    example: { request: { name: "Acme" }, response: { data: { id: "…", name: "Acme" } } },
  },
  {
    resource: "organizations",
    method: "PATCH",
    path: "/organizations/:id",
    scope: "write",
    summary: "Update a visible organization (contact.edit enforced by the service).",
    body: writeBody,
    handler: async (ctx, params, _query, body, signal) => {
      const parsed = writeBody.parse(body);
      const input: OrgUpdateInput = {
        id: params.id ?? "",
        ...(parsed.name === undefined ? {} : { name: parsed.name }),
        ...(parsed.address === undefined ? {} : { address: parsed.address }),
        ...(parsed.ownerId === undefined ? {} : { ownerId: parsed.ownerId }),
      };
      const actor = await contactActor(ctx.db, ctx.actor);
      const result = await updateOrg(ctx.db, actor, input, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: { request: { name: "Acme Ltd" }, response: { data: { id: "…" } } },
  },
  {
    resource: "organizations",
    method: "DELETE",
    path: "/organizations/:id",
    scope: "write",
    summary: "Soft-delete an organization (visible in the recycle bin for 30 days).",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await deleteOrg(
        ctx.db,
        await contactActor(ctx.db, ctx.actor),
        params.id ?? "",
        signal,
      );
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: params.id ?? "" }) };
    },
    example: { request: "DELETE /api/v1/organizations/{id}", response: { data: { id: "…" } } },
  },
];
