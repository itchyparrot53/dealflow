"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { addDealLine, type DealLine, removeDealLine, updateDealLine } from "./dealProducts";
import {
  createProduct,
  deleteProduct,
  type Product,
  setProductActive,
  updateProduct,
} from "./products";

// Product catalog actions. The permission check lives in products.ts so the
// integration tests can prove refusal; this module owns CSRF and the session.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createProductAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<Product>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createProduct(db, g.value, input, SIG()));
}

export async function updateProductAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<Product>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateProduct(db, g.value, input, SIG()));
}

export async function setProductActiveAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<Product>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setProductActive(db, g.value, input, SIG()));
}

export async function deleteProductAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteProduct(db, g.value, { id }, SIG()));
}

// Deal line mutations return the new net value beside the line, so the client can
// update the deal header without a second read.
export async function addDealLineAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ line: DealLine; value: string | null }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await addDealLine(db, g.value, input, SIG()));
}

export async function updateDealLineAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ line: DealLine; value: string | null }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateDealLine(db, g.value, input, SIG()));
}

export async function removeDealLineAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ value: string | null }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await removeDealLine(db, g.value, input, SIG()));
}
