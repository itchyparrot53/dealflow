"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { createForm, deleteForm, setFormActive, updateForm, type WebForm } from "./forms";

// Form actions. CSRF and the session live here; the service owns forms.manage.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createFormAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<WebForm>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createForm(db, g.value, input, SIG()));
}

export async function updateFormAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<WebForm>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateForm(db, g.value, id, input, SIG()));
}

export async function setFormActiveAction(
  id: string,
  active: boolean,
  csrfToken: string | null = null,
): Promise<ActionResult<WebForm>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setFormActive(db, g.value, id, active, SIG()));
}

export async function deleteFormAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteForm(db, g.value, id, SIG()));
}
