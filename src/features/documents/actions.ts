"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import {
  createDocument,
  type DocumentSummary,
  type DocumentView,
  deleteDraft,
  duplicateDocument,
  listDocumentsForDeal,
  refreshLines,
  updateDraft,
} from "./documents";
import { issueDocument, voidInvoice } from "./issue";
import { deletePayment, recordPayment } from "./payments";
import { getDocumentSendDraft, sendDocument } from "./send";
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

export async function createDocumentAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createDocument(db, g.value, input, SIG()));
}

export async function updateDraftAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateDraft(db, g.value, input, SIG()));
}

export async function refreshDocumentLinesAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await refreshLines(db, g.value, id, SIG()));
}

export async function duplicateDocumentAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await duplicateDocument(db, g.value, id, SIG()));
}

export async function deleteDraftAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteDraft(db, g.value, id, SIG()));
}

export async function listDealDocumentsAction(
  dealId: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentSummary[]>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await listDocumentsForDeal(db, g.value, dealId, SIG()));
}

export async function issueDocumentAction(
  id: string,
  via: "issue" | "markSent",
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await issueDocument(db, g.value, id, { via }, SIG()));
}

export async function voidInvoiceAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await voidInvoice(db, g.value, id, SIG()));
}

export async function recordPaymentAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await recordPayment(db, g.value, input, SIG()));
}

export async function deletePaymentAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deletePayment(db, g.value, id, SIG()));
}

// Read-only prefill for the send dialog. No CSRF: it changes nothing and the service applies the
// document's own visibility and edit rules.
export async function documentSendDraftAction(
  id: string,
): Promise<ActionResult<{ subject: string; messageHtml: string }>> {
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_LOGIN_REJECTED } };
  return toClientResult(await getDocumentSendDraft(db, actor, id, SIG()));
}

export async function sendDocumentAction(
  id: string,
  input: { to?: string; subject?: string; message?: string },
  csrfToken: string | null = null,
): Promise<ActionResult<DocumentView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await sendDocument(db, g.value, { id, ...input }, SIG()));
}
