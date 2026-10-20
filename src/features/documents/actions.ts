"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { type DocumentSettingsView, updateDocumentSettings } from "./settings";
import {
  createTemplate,
  type DocumentTemplateView,
  deleteTemplate,
  setDefaultTemplate,
  updateTemplate,
} from "./templates";

// Document settings and template actions. The permission check lives in the
// services so integration tests can prove refusal; this module owns CSRF and
// the session, matching the products actions.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function updateDocumentSettingsAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentSettingsView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateDocumentSettings(db, g.value, input, SIG()));
}

export async function createDocumentTemplateAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentTemplateView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createTemplate(db, g.value, input, SIG()));
}

export async function updateDocumentTemplateAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentTemplateView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateTemplate(db, g.value, input, SIG()));
}

export async function deleteDocumentTemplateAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteTemplate(db, g.value, id, SIG()));
}

export async function setDefaultDocumentTemplateAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentTemplateView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setDefaultTemplate(db, g.value, id, SIG()));
}
