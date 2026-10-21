import { and, eq, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { API_PAGE_DEFAULT, API_PAGE_MAX } from "@/constants/projectsApi";
import { products } from "@/db/schema";
import {
  createProduct,
  deleteProduct,
  getProduct,
  type productCreateInput,
  type productUpdateInput,
  updateProduct,
} from "@/features/products/products";
import { decodeCursor, encodeCursor } from "../cursor";
import { iso } from "../shared";
import { type ApiRoute, payload } from "../types";

// Product catalog. The catalog is shared, so reads need no visibility filter; writes are gated by
// products.manage inside the existing service.

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGE_MAX).optional(),
  cursor: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(64).nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  currency: z.string().trim().length(3),
  taxPercent: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/)
    .optional(),
});

const updateBody = createBody.partial();

type ProductRow = typeof products.$inferSelect;

function view(row: ProductRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    unit: row.unit,
    price: row.price,
    currency: row.currency,
    taxPercent: row.taxPercent,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export const productsRoutes: ApiRoute[] = [
  {
    resource: "products",
    method: "GET",
    path: "/products",
    scope: "read",
    summary: "List products, ordered by updated_at then id.",
    query: listQuery,
    handler: async (ctx, _params, query, _body, signal) => {
      const q = listQuery.parse(query);
      const limit = q.limit ?? API_PAGE_DEFAULT;
      const clauses: SQL[] = [];
      if (q.active !== undefined) clauses.push(eq(products.active, q.active === "true"));
      if (q.cursor !== undefined) {
        const cursor = decodeCursor(q.cursor);
        if (cursor.ok) {
          clauses.push(
            sql`(${products.updatedAt}, ${products.id}) > (${cursor.value.updatedAt}::timestamptz, ${cursor.value.id}::uuid)`,
          );
        }
      }
      const rows = await ctx.db
        .select()
        .from(products)
        .where(clauses.length === 0 ? undefined : and(...clauses))
        .orderBy(sql`${products.updatedAt} ASC, ${products.id} ASC`)
        .limit(limit + 1);
      signal.throwIfAborted();
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      const nextCursor =
        rows.length > limit && last !== undefined
          ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
          : undefined;
      return { ok: true, value: payload(page.map(view), nextCursor) };
    },
    example: {
      request: "GET /api/v1/products?active=true",
      response: { data: [{ id: "…", name: "Seat", price: "10.00", currency: "USD" }] },
    },
  },
  {
    resource: "products",
    method: "GET",
    path: "/products/:id",
    scope: "read",
    summary: "Read one product.",
    handler: async (ctx, params) => {
      const row = await getProduct(ctx.db, params.id ?? "", AbortSignal.timeout(10_000));
      if (row === null) {
        return { ok: false, error: new AppError(ERROR_IDS.PRODUCT_NOT_FOUND, "product not found") };
      }
      return { ok: true, value: payload(view(row)) };
    },
    example: { request: "GET /api/v1/products/{id}", response: { data: { id: "…" } } },
  },
  {
    resource: "products",
    method: "POST",
    path: "/products",
    scope: "write",
    summary: "Create a product (products.manage required).",
    body: createBody,
    handler: async (ctx, _params, _query, body, signal) => {
      const parsed = createBody.parse(body);
      const result = await createProduct(
        ctx.db,
        ctx.actor,
        {
          ...parsed,
          currency: parsed.currency.toUpperCase(),
          price: parsed.price ?? "0",
          taxPercent: parsed.taxPercent ?? "0",
        } satisfies z.input<typeof productCreateInput>,
        signal,
      );
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: {
      request: { name: "Seat", price: "10.00", currency: "USD" },
      response: { data: { id: "…", name: "Seat" } },
    },
  },
  {
    resource: "products",
    method: "PATCH",
    path: "/products/:id",
    scope: "write",
    summary: "Update a product (products.manage required).",
    body: updateBody,
    handler: async (ctx, params, _query, body, signal) => {
      const parsed = updateBody.parse(body);
      const result = await updateProduct(
        ctx.db,
        ctx.actor,
        {
          id: params.id ?? "",
          ...parsed,
          ...(parsed.currency === undefined ? {} : { currency: parsed.currency.toUpperCase() }),
        } satisfies z.input<typeof productUpdateInput>,
        signal,
      );
      if (!result.ok) return result;
      return { ok: true, value: payload(view(result.value)) };
    },
    example: { request: { price: "12.00" }, response: { data: { id: "…" } } },
  },
  {
    resource: "products",
    method: "DELETE",
    path: "/products/:id",
    scope: "write",
    summary: "Archive a product (products.manage required).",
    handler: async (ctx, params, _query, _body, signal) => {
      const result = await deleteProduct(ctx.db, ctx.actor, { id: params.id ?? "" }, signal);
      if (!result.ok) return result;
      return { ok: true, value: payload({ id: params.id ?? "" }) };
    },
    example: { request: "DELETE /api/v1/products/{id}", response: { data: { id: "…" } } },
  },
];
