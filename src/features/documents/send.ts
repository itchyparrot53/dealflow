import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { persons, users } from "@/db/schema";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import { getActorMailboxStatus } from "@/features/email/mailboxOwnership";
import { type SendEmailInput, sendEmail } from "@/features/email/send";
import { makeStorageClient, type StorageClient } from "@/features/files/storage";
import { type ResolveDeps, resolveMailProvider } from "@/features/mail/provider/resolve";
import type { MailProvider } from "@/features/mail/provider/types";
import type { PermSetUser } from "@/features/permissions/effective";
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
  message: z.string().max(4000).optional(),
});

export interface SendDocumentDeps {
  // Injected in tests: a fake transport factory for resolveMailProvider, or a
  // ready provider. Production leaves both unset.
  resolveDeps?: ResolveDeps;
  provider?: MailProvider;
  storage?: StorageClient;
}

interface MailContent {
  subject: string;
  bodyHtml: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The composer sends HTML. Escape the plain text first, then keep paragraph and
// line breaks, so customer names and messages can never inject markup.
function toBodyHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function defaultSubject(kind: DocKind, number: string, from: string): string {
  return `${kind === "quote" ? "Quote" : "Invoice"} ${number} from ${from}`;
}

function defaultMessage(kind: DocKind, firstName: string): string {
  const greeting = firstName === "" ? "Hi" : `Hi ${firstName}`;
  return `${greeting}, here is your ${kind === "quote" ? "quote" : "invoice"}.`;
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

async function composeMail(
  db: Db,
  document: DocumentView,
  deal: { personId: string | null; ownerId: string },
  settings: DocumentSettingsView,
  input: { subject?: string; message?: string },
): Promise<MailContent> {
  const [owner] = await db.select().from(users).where(eq(users.id, deal.ownerId));
  let firstName = "";
  if (deal.personId !== null) {
    const [person] = await db.select().from(persons).where(eq(persons.id, deal.personId));
    firstName = person?.firstName ?? person?.name.split(" ")[0] ?? "";
  }
  const from = settings.companyName ?? owner?.name ?? "";
  const subject = input.subject ?? defaultSubject(document.kind, document.number ?? "", from);
  const message = input.message ?? defaultMessage(document.kind, firstName);
  const text = `${message}\n\nView it here: ${document.publicUrl}\n\n${owner?.name ?? ""}`;
  return { subject, bodyHtml: toBodyHtml(text) };
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

  // Issue before the send, committed; a mail failure leaves an issued document.
  let document = current.value;
  if (document.status === "draft") {
    const issued = await issueDocument(db, actor, document.id, { via: "issue" }, signal);
    if (!issued.ok) return issued;
    document = issued.value;
  } else if (document.status === "void") {
    return err(
      new AppError(ERROR_IDS.DOC_TRANSITION, "A void document cannot be sent", {
        status: document.status,
      }),
    );
  }

  const settings = await getDocumentSettings(db, signal);
  const content = await composeMail(db, document, deal, settings, input);

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

  const payload: SendEmailInput = {
    accountId: target.value.mailboxId,
    idempotencyKey: randomUUID(),
    to: [target.value.recipient],
    subject: content.subject,
    bodyHtml: content.bodyHtml,
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
