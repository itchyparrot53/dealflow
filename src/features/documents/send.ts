import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { persons, users } from "@/db/schema";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import { getActorMailboxStatus } from "@/features/email/mailboxOwnership";
import { sanitizeAuthorHtml } from "@/features/email/sanitizeHtml";
import { type SendEmailInput, sendEmail } from "@/features/email/send";
import { getEmailDesign } from "@/features/email-design/design";
import { resolveTemplate } from "@/features/email-design/templates";
import { renderVariables, stripHeaderBreaks } from "@/features/email-design/variables";
import { wrapCustomerEmail } from "@/features/email-design/wrapCustomerEmail";
import { makeStorageClient, type StorageClient } from "@/features/files/storage";
import { type ResolveDeps, resolveMailProvider } from "@/features/mail/provider/resolve";
import type { MailProvider } from "@/features/mail/provider/types";
import type { PermSetUser } from "@/features/permissions/effective";
import { formatCalendarDate } from "@/lib/format/date";
import { currencyMinorDigits, formatMoney } from "@/lib/format/number";
import { err, ok, type Result } from "@/types/result";
import { type DocumentView, getDocument, toDocumentError } from "./documents";
import { issueDocument } from "./issue";
import { type DocumentSettingsView, getDocumentSettings } from "./settings";
import type { DocKind } from "./transitions";

// Sending emails the customer a link to the public page through the actor's own
// mailbox, using the same compose path the inbox composer uses (ownership check,
// outbox, CRM copy). The message is linked to the deal so it lands on the timeline.

export const sendDocumentInput = z.object({
  id: z.string().uuid(),
  to: z.string().trim().email().max(320).optional(),
  subject: z.string().trim().max(200).optional(),
  // The dialog sends rich text (TipTap), so the message is sanitised HTML, not a plain string.
  message: z.string().max(20_000).optional(),
});

export interface SendDocumentDeps {
  // Injected in tests: a fake transport factory for resolveMailProvider, or a
  // ready provider. Production leaves both unset.
  resolveDeps?: ResolveDeps;
  provider?: MailProvider;
  storage?: StorageClient;
}

export interface DocumentMail {
  subject: string;
  bodyHtml: string;
  ctaLabel: string;
  summary: { label: string; value: string }[];
}

function documentKey(kind: DocKind): "quote_sent" | "invoice_sent" {
  return kind === "quote" ? "quote_sent" : "invoice_sent";
}

function dateOrEmpty(value: string | null): string {
  return value === null || value === "" ? "" : formatCalendarDate(value);
}

function formattedTotal(document: DocumentView): string {
  const minor = Math.round(Number(document.total) * 10 ** currencyMinorDigits(document.currency));
  return formatMoney(minor, document.currency, { decimals: 2 });
}

async function documentVariables(
  db: Db,
  document: DocumentView,
  deal: { personId: string | null; ownerId: string },
  settings: DocumentSettingsView,
): Promise<Record<string, string>> {
  const [owner] = await db.select().from(users).where(eq(users.id, deal.ownerId));
  let customerName = document.customerName ?? "";
  if (deal.personId !== null) {
    const [person] = await db.select().from(persons).where(eq(persons.id, deal.personId));
    customerName = person?.name ?? customerName;
  }
  return {
    "company.name": settings.companyName ?? owner?.name ?? "",
    "app.url": env.BASE_URL,
    "customer.name": customerName,
    "document.number": document.number ?? "",
    "document.title": document.title,
    "document.total": formattedTotal(document),
    "document.valid_until": dateOrEmpty(document.validUntil),
    "document.due_date": dateOrEmpty(document.dueDate),
    "document.url": document.publicUrl,
    "sender.name": owner?.name ?? "",
  };
}

async function composeMail(
  db: Db,
  document: DocumentView,
  deal: { personId: string | null; ownerId: string },
  settings: DocumentSettingsView,
  input: { subject?: string; message?: string },
  signal: AbortSignal,
): Promise<Result<DocumentMail, AppError>> {
  const key = documentKey(document.kind);
  const template = await resolveTemplate(db, key, signal);
  if (!template.ok) return template;
  const variables = await documentVariables(db, document, deal, settings);
  const subject =
    input.subject !== undefined && input.subject.trim() !== ""
      ? input.subject.trim().slice(0, 200)
      : stripHeaderBreaks(
          renderVariables(template.value.subject, variables, { mode: "text" }),
          200,
        );
  const bodyHtml =
    input.message !== undefined && input.message.trim() !== ""
      ? sanitizeAuthorHtml(input.message)
      : sanitizeAuthorHtml(renderVariables(template.value.bodyHtml, variables, { mode: "html" }));
  return ok({
    subject,
    bodyHtml,
    ctaLabel:
      template.value.ctaLabel ?? (document.kind === "quote" ? "View quote" : "View invoice"),
    summary: [
      {
        label: document.kind === "quote" ? "Quote" : "Invoice",
        value: variables["document.number"] ?? "",
      },
      { label: "Total", value: variables["document.total"] ?? "" },
      {
        label: document.kind === "quote" ? "Valid until" : "Due date",
        value:
          document.kind === "quote"
            ? (variables["document.valid_until"] ?? "")
            : (variables["document.due_date"] ?? ""),
      },
    ],
  });
}

// Issue before the send, committed; a mail failure leaves an issued document.
async function issueBeforeSend(
  db: Db,
  actor: PermSetUser,
  current: DocumentView,
  signal: AbortSignal,
): Promise<Result<DocumentView, AppError>> {
  if (current.status === "draft") {
    return issueDocument(db, actor, current.id, { via: "issue" }, signal);
  }
  if (current.status === "void") {
    return err(
      new AppError(ERROR_IDS.DOC_TRANSITION, "A void document cannot be sent", {
        status: current.status,
      }),
    );
  }
  return ok(current);
}

async function wrapDocumentMail(
  db: Db,
  document: DocumentView,
  content: DocumentMail,
  signal: AbortSignal,
): Promise<Result<string, AppError>> {
  const design = await getEmailDesign(db, signal);
  return ok(
    wrapCustomerEmail({
      bodyHtml: content.bodyHtml,
      mode: "document",
      design,
      summary: { rows: content.summary },
      cta: { label: content.ctaLabel, url: document.publicUrl },
    }).html,
  );
}

// Read-only prefill for the send dialog: the same copy the server would send.
export async function getDocumentSendDraft(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ subject: string; messageHtml: string }, AppError>> {
  const current = await getDocument(db, actor, id, signal);
  if (!current.ok) return current;
  const editable = await loadEditableDeal(db, actor, current.value.dealId, signal);
  if (!editable.ok) return err(toDocumentError(editable.error));
  const settings = await getDocumentSettings(db, signal);
  const mail = await composeMail(db, current.value, editable.value.deal, settings, {}, signal);
  if (!mail.ok) return mail;
  return ok({ subject: mail.value.subject, messageHtml: mail.value.bodyHtml });
}

// Recipient and mailbox are checked before the draft is issued, so a refusal
// leaves the document as the user left it.
async function resolveTarget(
  db: Db,
  actor: PermSetUser,
  document: DocumentView,
  to: string | undefined,
  signal: AbortSignal,
): Promise<Result<{ recipient: string; mailboxId: string }, AppError>> {
  const recipient = to ?? document.customerEmail;
  if (recipient === null || recipient === "") {
    return err(
      new AppError(ERROR_IDS.DOC_NO_CUSTOMER_EMAIL, "No customer email", {
        documentId: document.id,
      }),
    );
  }
  // A disconnected mailbox is the same user problem as no mailbox: E_DOC_006.
  const mailbox = await getActorMailboxStatus(db, actor.id, signal);
  if (mailbox === null || mailbox.status !== "connected") {
    return err(
      new AppError(ERROR_IDS.DOC_NO_MAILBOX, "No connected mailbox", { userId: actor.id }),
    );
  }
  return ok({ recipient, mailboxId: mailbox.id });
}

export async function sendDocument(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
  deps: SendDocumentDeps = {},
): Promise<Result<DocumentView, AppError>> {
  const parsed = sendDocumentInput.safeParse(raw);
  if (!parsed.success) {
    return err(new AppError(ERROR_IDS.DOC_INPUT_INVALID, "send input failed validation"));
  }
  const input = parsed.data;

  const current = await getDocument(db, actor, input.id, signal);
  if (!current.ok) return current;
  const editable = await loadEditableDeal(db, actor, current.value.dealId, signal);
  if (!editable.ok) return err(toDocumentError(editable.error));
  const deal = editable.value.deal;

  const target = await resolveTarget(db, actor, current.value, input.to, signal);
  if (!target.ok) return target;

  const issued = await issueBeforeSend(db, actor, current.value, signal);
  if (!issued.ok) return issued;
  const document = issued.value;

  const settings = await getDocumentSettings(db, signal);
  const content = await composeMail(db, document, deal, settings, input, signal);
  if (!content.ok) return content;

  let resolved: MailProvider;
  if (deps.provider !== undefined) {
    resolved = deps.provider;
  } else {
    const provider = await resolveMailProvider(
      db,
      target.value.mailboxId,
      signal,
      deps.resolveDeps,
    );
    if (!provider.ok) return err(provider.error);
    resolved = provider.value;
  }

  const wrapped = await wrapDocumentMail(db, document, content.value, signal);
  if (!wrapped.ok) return wrapped;
  const payload: SendEmailInput = {
    accountId: target.value.mailboxId,
    idempotencyKey: randomUUID(),
    to: [target.value.recipient],
    subject: content.value.subject,
    bodyHtml: wrapped.value,
    linkDealId: document.dealId,
    ...(deal.personId !== null ? { linkPersonId: deal.personId } : {}),
  };

  try {
    const sent = await sendEmail(db, {
      actorId: actor.id,
      actorType: actor.type,
      actorGroupIds: actor.groupIds,
      provider: resolved,
      storage: deps.storage ?? makeStorageClient(),
      input: payload,
      // No caller signal: sendEmail picks MAIL_SEND_TIMEOUT_MS for an IMAP send, so
      // the SMTP send plus its Sent append is not cut short by the action budget.
    });
    if (!sent.ok) return err(sent.error);
  } finally {
    // Only close a provider this call resolved; an injected one belongs to the caller.
    if (deps.provider === undefined) await resolved.close();
  }

  return getDocument(db, actor, document.id, signal);
}

// The public link the UI shows and the send body uses; exported so the page and
// the dialog agree without reconstructing it.
export function publicDocumentUrl(publicId: string): string {
  return `${env.BASE_URL}/d/${publicId}`;
}
