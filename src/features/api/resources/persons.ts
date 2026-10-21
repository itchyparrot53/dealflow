import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { persons } from "@/db/schema";
import { deletePerson } from "@/features/contacts/deletePerson";
import { createPerson, toVisibleRecord, updatePerson } from "@/features/contacts/personsRepo";
import type { PersonCreateInput, PersonUpdateInput } from "@/features/contacts/schemas";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import { decodeCursor, encodeCursor } from "../cursor";
import { contactActor, iso } from "../shared";
import { type ApiRoute, payload } from "../types";

// People. Reads apply the contacts visibility predicate (canSee) exactly like the People list;
// writes go through createPerson/updatePerson/deletePerson so contact.edit is enforced.

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  updated_since: z.string().datetime().optional(),
  search: z.string().trim().max(200).optional(),
  organizationId: z.uuid().optional(),
});

const writeBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  emails: z.array(z.string().email()).optional(),
  phones: z.array(z.string().trim().min(1).max(50)).optional(),
  organizationId: z.uuid().nullable().optional(),
  ownerId: z.uuid().optional(),
});

const createBody = writeBody.extend({ name: z.string().trim().min(1).max(255) });

type PersonRow = typeof persons.$inferSelect;

function view(row: PersonRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    emails: row.emails,
    phones: row.phones,
    organizationId: row.orgId,
    ownerId: row.ownerId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function createInput(input: z.infer<typeof createBody>): PersonCreateInput {
  return {
    name: input.name,
    emails: (input.emails ?? []).map((value, index) => ({
      value,
      label: "",
      primary: index === 0,
    })),
    phones: (input.phones ?? []).map((value, index) => ({
      value,
      label: "",
      primary: index === 0,
    })),
    orgId: input.organizationId ?? null,
    customFields: {},
  };
}

function updateInput(id: string, input: z.infer<typeof writeBody>): PersonUpdateInput {
  return {
    id,
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.emails === undefined
      ? {}
      : {
          emails: input.emails.map((value, index) => ({
            value,
            label: "",
            primary: index === 0,
          })),
        }),
    ...(input.phones === undefined
      ? {}
      : {
          phones: input.phones.map((value, index) => ({
            value,
            label: "",
            primary: index === 0,
          })),
        }),
    ...(input.organizationId === undefined ? {} : { orgId: input.organizationId }),
    ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
  };
}

async function page(
  db: Db,
  actor: PermSetUser,
  q: z.infer<typeof listQuery>,
): Promise<{ rows: PersonRow[]; nextCursor?: string }> {
  const limit = q.limit ?? API_PAGE_DEFAULT;
  const clauses: SQL[] = [isNull(persons.deletedAt)];
  if (q.organizationId !== undefined) clauses.push(eq(persons.orgId, q.organizationId));
  if (q.search !== undefined && q.search !== "") {
    const pattern = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push(sql`${persons.name} ILIKE ${pattern}`);
  }
  if (q.updated_since !== undefined) {
    clauses.push(sql`${persons.updatedAt} >= ${q.updated_since}::timestamptz`);
  }
  if (q.cursor !== undefined) {
    const cursor = decodeCursor(q.cursor);
    if (cursor.ok) {
      clauses.push(
        sql`(${persons.updatedAt}, ${persons.id}) > (${cursor.value.updatedAt}::timestamptz, ${cursor.value.id}::uuid)`,
      );
    }
  }
  const scanned = await db
    .select()
    .from(persons)
    .where(and(...clauses))
    .orderBy(sql`${persons.updatedAt} ASC, ${persons.id} ASC`)
    .limit(limit * 4);
  const visible = scanned.filter((row) => canSee(actor, toVisibleRecord(row))).slice(0, limit);
  const last = visible[visible.length - 1];
  return {
    rows: visible,
    nextCursor:
      visible.length === limit && last !== undefined
        ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
        : undefined,
  };
}

export const personsRoutes: ApiRoute[] = [
  {
    resource: "persons",
    method: "GET",
    path: "/persons",
    scope: "read",
    summary: "List visible people, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      signal.throwIfAborted();
      const result = await page(ctx.db, ctx.actor, q);
      return { ok: true, value: payload(result.rows.map(view), result.nextCursor) };
    },
    example: {
      request: "GET /api/v1/persons?search=acme",
      response: { data: [{ id: "…", name: "Pat Person", emails: [], phones: [] }] },
    },
  },
  {
    resource: "persons",
    method: "GET",
    path: "/persons/:id",
    scope: "read",
    summary: "Read one visible person.",
    handler: async (ctx, params) => {
      const [row] = await ctx.db
        .select()
        .from(persons)
        .where(and(eq(persons.id, params.id ?? ""), isNull(persons.deletedAt)));
      if (row === undefined || !canSee(ctx.actor, toVisibleRecord(row))) {
        return { ok: false, error: new AppError(ERROR_IDS.CONTACT_NOT_FOUND, "person not found") };
      }
      return { ok: true, value: payload(view(row)) };
    },
    example: { request: "GET /api/v1/persons/{id}", response: { data: { id: "…" } } },
  },
  {
    resource: "persons",
    method: "POST",
    path: "/persons",
    scope: "write",
    summary: "Create a person as the token's user.",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const actor = await contactActor(ctx.db, ctx.actor);
      const result = await createPerson(ctx.db, actor, createInput(parsed), signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: {
      request: { name: "Pat Person" },
      response: { data: { id: "…", name: "Pat Person" } },
    },
  },
  {
    resource: "persons",
    method: "PATCH",
    path: "/persons/:id",
    scope: "write",
    summary: "Update a visible person (contact.edit enforced by the service).",
    body: writeBody,
    handler: async (ctx, params, _query, body, signal) => {
      const parsed = writeBody.parse(body);
      const actor = await contactActor(ctx.db, ctx.actor);
      const result = await updatePerson(
        ctx.db,
        actor,
        updateInput(params.id ?? "", parsed),
        signal,
      );
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: { request: { name: "Pat P." }, response: { data: { id: "…" } } },
  },
  {
    resource: "persons",
    method: "DELETE",
    path: "/persons/:id",
    scope: "write",
    summary: "Soft-delete a person (visible in the recycle bin for 30 days).",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await deletePerson(
        ctx.db,
        await contactActor(ctx.db, ctx.actor),
        params.id ?? "",
        signal,
      );
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: params.id ?? "" }) };
    },
    example: { request: "DELETE /api/v1/persons/{id}", response: { data: { id: "…" } } },
  },
];
