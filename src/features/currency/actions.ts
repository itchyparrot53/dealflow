"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { deleteRate, type RateRow, saveRate, setBaseCurrency } from "./rates";

// Currency settings actions. The permission check lives in rates.ts so the
// integration tests can prove a non-admin is refused; this module owns CSRF and
// the session, and every service call is a Result.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function saveRateAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<RateRow>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await saveRate(db, g.value, input, SIG()));
}

export async function deleteRateAction(
  code: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteRate(db, g.value, code, SIG()));
}

export async function setBaseCurrencyAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ base: string }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setBaseCurrency(db, g.value, input, SIG()));
}
