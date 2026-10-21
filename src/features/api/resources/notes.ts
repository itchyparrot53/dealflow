import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import { notes } from "@/db/schema";
import { createNote, softDeleteNote, updateNote } from "@/features/collaboration/notesRepo";
import type { NoteCreateInput } from "@/features/collaboration/notesSchemas";
import { canActorAccessParent } from "@/features/files/fileAuthz";
import type { PermSetUser } from "@/features/permissions/effective";
import { decodeCursor, encodeCursor } from "../cursor";
import { iso } from "../shared";
import { type ApiRoute, payload } from "../types";

// Notes. A note's parent is the visibility gate; the shared fileAuthz check answers "may this user
// open that deal/person/organization?", so a token can never read a note on an invisible record.

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  dealId: z.uuid().optional(),
  personId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
});

const createBody = z
  .object({
    body: z.string().min(1).max(50_000),
    dealId: z.uuid().optional(),
    personId: z.uuid().optional(),
    organizationId: z.uuid().optional(),
  })
  .refine(
    (v) =>
      [v.dealId, v.personId, v.organizationId].filter((value) => value !== undefined).length === 1,
    { message: "exactly one of dealId, personId or organizationId is required" },
  );

const updateBody = z.object({ body: z.string().min(1).max(50_000) });

type NoteRow = typeof notes.$inferSelect;

function parent(row: NoteRow): Record<string, string | null> {
  return {
    dealId: row.entityType === "deal" ? row.entityId : null,
    personId: row.entityType === "person" ? row.entityId : null,
    organizationId: row.entityType === "organization" ? row.entityId : null,
  };
}

function view(row: NoteRow): Record<string, unknown> {
  return {
    id: row.id,
    body: row.body,
    ...parent(row),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function canRead(
  db: Db,
  actor: PermSetUser,
  row: NoteRow,
  signal: AbortSignal,
): Promise<boolean> {
  return canActorAccessParent(db, actor, row.entityType, row.entityId, signal);
}

export const notesRoutes: ApiRoute[] = [
  {
    resource: "notes",
    method: "GET",
    path: "/notes",
    scope: "read",
    summary: "List visible notes, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      const limit = q.limit ?? API_PAGE_DEFAULT;
      const clauses: SQL[] = [isNull(notes.deletedAt)];
      if (q.dealId !== undefined) {
        clauses.push(eq(notes.entityType, "deal"), eq(notes.entityId, q.dealId));
      }
      if (q.personId !== undefined) {
        clauses.push(eq(notes.entityType, "person"), eq(notes.entityId, q.personId));
      }
      if (q.organizationId !== undefined) {
        clauses.push(eq(notes.entityType, "organization"), eq(notes.entityId, q.organizationId));
      }
      if (q.cursor !== undefined) {
        const cursor = decodeCursor(q.cursor);
        if (cursor.ok) {
          clauses.push(
            sql`(${notes.updatedAt}, ${notes.id}) > (${cursor.value.updatedAt}::timestamptz, ${cursor.value.id}::uuid)`,
          );
        }
      }
      const scanned = await ctx.db
        .select()
        .from(notes)
        .where(and(...clauses))
        .orderBy(sql`${notes.updatedAt} ASC, ${notes.id} ASC`)
        .limit(limit * 4);
      signal.throwIfAborted();
      const visible: NoteRow[] = [];
      for (const row of scanned) {
        if (visible.length >= limit) break;
        if (await canRead(ctx.db, ctx.actor, row, signal)) visible.push(row);
      }
      const last = visible[visible.length - 1];
      const nextCursor =
        visible.length === limit && last !== undefined
          ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
          : undefined;
      return { ok: true, value: payload(visible.map(view), nextCursor) };
    },
    example: {
      request: "GET /api/v1/notes?dealId={dealId}",
      response: { data: [{ id: "…", body: "Called back", dealId: "…" }] },
    },
  },
  {
    resource: "notes",
    method: "POST",
    path: "/notes",
    scope: "write",
    summary: "Add a note to one visible record.",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const input: NoteCreateInput = {
        entityType:
          parsed.dealId !== undefined
            ? "deal"
            : parsed.personId !== undefined
              ? "person"
              : "organization",
        entityId: (parsed.dealId ?? parsed.personId ?? parsed.organizationId) as string,
        body: parsed.body,
        pinned: false,
      };
      const result = await createNote(ctx.db, ctx.actor, input, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: {
      request: { body: "Called back", dealId: "…" },
      response: { data: { id: "…", body: "Called back" } },
    },
  },
  {
    resource: "notes",
    method: "PATCH",
    path: "/notes/:id",
    scope: "write",
    summary: "Edit a note body.",
    body: updateBody,
    handler: async (ctx, params, _query, body, signal) => {
      const parsed = updateBody.parse(body);
      const result = await updateNote(ctx.db, ctx.actor, params.id ?? "", parsed.body, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: { request: { body: "Edited" }, response: { data: { id: "…", body: "Edited" } } },
  },
  {
    resource: "notes",
    method: "DELETE",
    path: "/notes/:id",
    scope: "write",
    summary: "Soft-delete a note.",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await softDeleteNote(ctx.db, ctx.actor, params.id ?? "", signal);
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: result.value.id }) };
    },
    example: { request: "DELETE /api/v1/notes/{id}", response: { data: { id: "…" } } },
  },
];

export const noteErrors = {
  notFound: () => new AppError(ERROR_IDS.NOTE_NOT_FOUND, "note not found"),
};
