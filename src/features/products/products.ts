import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { dealProducts, products } from "@/db/schema";
import { isSupportedCurrency, moneyString, percentString } from "@/features/currency/schemas";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// Product catalog. Prices are decimal strings in the product's own currency;
// adding a product to a deal converts them at that moment (dealProducts.ts).

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PRODUCTS_CODE_INDEX = "products_code_uq";
const MAX_LIST = 200;

export const productFields = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(64).nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  price: moneyString,
  currency: z.string(),
  taxPercent: percentString,
});

export const productCreateInput = productFields.extend({
  price: moneyString.default("0"),
  taxPercent: percentString.default("0"),
});
export const productUpdateInput = productFields.partial().extend({ id: z.string().uuid() });
export const productActiveInput = z.object({ id: z.string().uuid(), active: z.boolean() });
export const productIdInput = z.object({ id: z.string().uuid() });

export interface ProductListInput {
  search?: string;
  includeInactive?: boolean;
}

export type Product = typeof products.$inferSelect;

function pgErrorMatches(error: unknown, code: string, constraint?: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    const row = current as { code?: unknown; constraint?: unknown };
    if (row.code === code && (constraint === undefined || row.constraint === constraint))
      return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function canManage(actor: PermSetUser): boolean {
  return can(actor, "products.manage");
}

function deny(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "products.manage required", { userId: actor.id });
}

function invalid(field: string): AppError {
  return new AppError(ERROR_IDS.PRODUCT_INPUT_INVALID, `Invalid product ${field}`);
}

function escapedLike(search: string): string {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function listProducts(
  db: Db,
  input: ProductListInput,
  signal: AbortSignal,
): Promise<Product[]> {
  signal.throwIfAborted();
  const term = input.search?.trim() ?? "";
  const filters = [];
  if (term !== "") {
    const pattern = escapedLike(term);
    filters.push(or(ilike(products.name, pattern), ilike(products.code, pattern)));
  }
  if (input.includeInactive !== true) filters.push(eq(products.active, true));
  return db
    .select()
    .from(products)
    .where(filters.length === 0 ? undefined : and(...filters))
    .orderBy(desc(products.active), asc(products.name))
    .limit(MAX_LIST);
}

export async function getProduct(db: Db, id: string, signal: AbortSignal): Promise<Product | null> {
  signal.throwIfAborted();
  const [row] = await db.select().from(products).where(eq(products.id, id));
  return row ?? null;
}

export async function createProduct(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<Product, AppError>> {
  if (!canManage(actor)) return err(deny(actor));
  const parsed = productCreateInput.safeParse(raw);
  if (!parsed.success) return err(invalid("input"));
  if (!isSupportedCurrency(parsed.data.currency)) {
    return err(new AppError(ERROR_IDS.CURRENCY_UNKNOWN, "Unknown currency code"));
  }
  signal.throwIfAborted();
  try {
    const [row] = await db
      .insert(products)
      .values({ ...parsed.data, createdBy: actor.id })
      .returning();
    if (row === undefined) {
      throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "createProduct: insert returned no rows");
    }
    return ok(row);
  } catch (error) {
    if (pgErrorMatches(error, PG_UNIQUE_VIOLATION, PRODUCTS_CODE_INDEX)) {
      return err(codeTaken(parsed.data.code));
    }
    throw error;
  }
}

export async function updateProduct(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<Product, AppError>> {
  if (!canManage(actor)) return err(deny(actor));
  const parsed = productUpdateInput.safeParse(raw);
  if (!parsed.success) return err(invalid("input"));
  if (parsed.data.currency !== undefined && !isSupportedCurrency(parsed.data.currency)) {
    return err(new AppError(ERROR_IDS.CURRENCY_UNKNOWN, "Unknown currency code"));
  }
  const { id, ...changes } = parsed.data;
  signal.throwIfAborted();
  try {
    const [row] = await db
      .update(products)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    if (row === undefined) {
      return err(new AppError(ERROR_IDS.PRODUCT_NOT_FOUND, "Product not found", { productId: id }));
    }
    return ok(row);
  } catch (error) {
    if (pgErrorMatches(error, PG_UNIQUE_VIOLATION, PRODUCTS_CODE_INDEX)) {
      return err(codeTaken(changes.code ?? null));
    }
    throw error;
  }
}

export async function setProductActive(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<Product, AppError>> {
  if (!canManage(actor)) return err(deny(actor));
  const parsed = productActiveInput.safeParse(raw);
  if (!parsed.success) return err(invalid("status"));
  signal.throwIfAborted();
  const [row] = await db
    .update(products)
    .set({ active: parsed.data.active, updatedAt: new Date() })
    .where(eq(products.id, parsed.data.id))
    .returning();
  if (row === undefined) {
    return err(
      new AppError(ERROR_IDS.PRODUCT_NOT_FOUND, "Product not found", { productId: parsed.data.id }),
    );
  }
  return ok(row);
}

export async function deleteProduct(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  if (!canManage(actor)) return err(deny(actor));
  const parsed = productIdInput.safeParse(raw);
  if (!parsed.success) return err(invalid("id"));
  signal.throwIfAborted();

  const [used] = await db
    .select({ id: dealProducts.id })
    .from(dealProducts)
    .where(eq(dealProducts.productId, parsed.data.id))
    .limit(1);
  if (used !== undefined) {
    return err(
      new AppError(ERROR_IDS.PRODUCT_IN_USE, "Product is used on a deal", {
        productId: parsed.data.id,
      }),
    );
  }
  try {
    await db.delete(products).where(eq(products.id, parsed.data.id));
  } catch (error) {
    // A line can land between the check and the delete; the FK still refuses.
    if (pgErrorMatches(error, PG_FOREIGN_KEY_VIOLATION)) {
      return err(
        new AppError(ERROR_IDS.PRODUCT_IN_USE, "Product is used on a deal", {
          productId: parsed.data.id,
        }),
      );
    }
    throw error;
  }
  return ok(undefined);
}

function codeTaken(code: string | null | undefined): AppError {
  return new AppError(ERROR_IDS.PRODUCT_CODE_TAKEN, "Product code already taken", {
    code: code ?? null,
  });
}
