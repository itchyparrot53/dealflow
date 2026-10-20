import { sql } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { MAIL_APPEND_TIMEOUT_MS } from "@/constants/mail";
import type { Db } from "@/db/client";
import { err, ok, type Result } from "@/types/result";
import type { MailCredentials } from "../connect/credentials";
import { normalizeMessageId } from "../parse/messageId";
import { stripBccHeader } from "../parse/stripBcc";
import type { SentMessage } from "../provider/types";
import type { ImapSession, MailTransportFactory } from "../transport/types";
import { appendToSent, bumpAppendTries, recordAppendAttempt } from "./appendSent";
import { checkDailyQuota } from "./throttle";

// The folder the mailbox uses for sent mail. Servers normally flag it, but a fallback by name
// covers the ones that do not.
export async function sentFolderPath(
  session: ImapSession,
  signal: AbortSignal,
): Promise<string | null> {
  const folders = await session.listFolders(signal);
  if (!folders.ok) return null;
  const flagged = folders.value.find((folder) => folder.specialUse === "sent");
  if (flagged !== undefined) return flagged.path;
  return folders.value.find((folder) => folder.path.toLowerCase() === "sent")?.path ?? null;
}

function snippetOf(text: string | null | undefined): string | null {
  if (text === null || text === undefined || text.trim() === "") return null;
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
}

// The CRM copy's preview comes from the text part the attempt stored; the HTML body is the
// fallback for a message with no text alternative.
async function previewSnippet(db: Db, attemptId: string): Promise<string | null> {
  const rows = (
    await db.execute(sql`
      SELECT payload->>'text' AS text, payload->>'html' AS html
      FROM email_send_attempts WHERE id = ${attemptId}
    `)
  ).rows as { text: string | null; html: string | null }[];
  const row = rows[0];
  if (row === undefined) return null;
  return snippetOf(row.text) ?? snippetOf(stripTags(row.html ?? ""));
}

export interface SendImapArgs {
  db: Db;
  accountId: string;
  credentials: MailCredentials;
  transports: MailTransportFactory;
  raw: string;
  messageIdHeader: string;
  envelope: { from: string; to: string[] };
  providerThreadId: string | null;
  parentProviderMessageId: string | null;
  reply: { inReplyTo?: string; references?: string };
  attemptId: string;
  signal: AbortSignal;
  limits?: { dailyRecipients?: number; maxRecipients?: number };
}

// SMTP send, then the Sent copy. Bcc never reaches the wire copy; the APPEND carries the full
// message because that copy is ours. A failed APPEND never fails the send: the row waits for the
// retry job instead.
export async function sendImapMessage(args: SendImapArgs): Promise<Result<SentMessage, AppError>> {
  const maxRecipients = args.limits?.maxRecipients ?? env.MAIL_SEND_MAX_RECIPIENTS;
  if (args.envelope.to.length > maxRecipients) {
    return err(
      new AppError(ERROR_IDS.MAIL_TOO_MANY_RECIPIENTS, "too many recipients", {
        count: args.envelope.to.length,
      }),
    );
  }

  const quota = await checkDailyQuota(
    args.db,
    args.accountId,
    args.envelope.to.length,
    new Date(),
    args.limits?.dailyRecipients,
  );
  if (!quota.ok) return quota;

  const wire = Buffer.from(stripBccHeader(args.raw));
  const delivered = await args.transports
    .smtp(args.credentials.smtp)
    .send(wire, args.envelope, args.signal);
  if (!delivered.ok) return delivered;

  const providerMessageId = normalizeMessageId(args.messageIdHeader) ?? args.messageIdHeader;
  const providerThreadId = args.providerThreadId ?? `imap:${providerMessageId}`;
  await recordAppendAttempt(args.db, args.attemptId, args.accountId);

  // Its own budget: a slow APPEND must never abort a send SMTP already accepted.
  await appendSentWithOwnBudget(args, providerMessageId);

  const snippet = await previewSnippet(args.db, args.attemptId);
  return ok({
    providerMessageId,
    providerThreadId,
    snippet,
    headers: {
      rfc822MessageId: providerMessageId,
      inReplyTo: args.reply.inReplyTo ?? null,
      references: (args.reply.references ?? "").split(/\s+/).filter((part) => part !== ""),
    },
  });
}

async function appendSentWithOwnBudget(
  args: SendImapArgs,
  providerMessageId: string,
): Promise<void> {
  const budget = AbortSignal.timeout(MAIL_APPEND_TIMEOUT_MS);
  const opened = await args.transports.openImap(args.credentials.imap, budget);
  if (!opened.ok) {
    // No session means no APPEND happened; count it so the row still reaches gave_up.
    await bumpAppendTries(args.db, args.attemptId, opened.error.id);
    return;
  }
  try {
    await appendToSent({
      db: args.db,
      session: opened.value,
      attemptId: args.attemptId,
      accountId: args.accountId,
      providerMessageId,
      raw: args.raw,
      signal: budget,
    });
  } finally {
    await opened.value.close();
  }
}
