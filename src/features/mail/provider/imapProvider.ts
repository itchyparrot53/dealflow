import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { hydrateOwner } from "@/features/email/syncCursor";
import { err, ok } from "@/types/result";
import type { MailCredentials } from "../connect/credentials";
import { fetchImapAttachment } from "../imap/attachments";
import { sendImapMessage, sentFolderPath } from "../imap/send";
import { syncImapAccount } from "../imap/sync";
import { trashImapThread } from "../imap/trash";
import { normalizeMessageId } from "../parse/messageId";
import type { MailTransportFactory } from "../transport/types";
import type { MailProvider } from "./types";

export interface ImapProviderOptions {
  // Tests pass small limits; production uses the env defaults (Task 4.3).
  limits?: { dailyRecipients?: number; maxRecipients?: number };
}

// The IMAP implementation: sync over the shared engine, send over SMTP plus the Sent APPEND,
// replies and reconcile from the stored headers, attachments re-fetched on demand, and trash by
// MOVE. Every method opens its own session and closes it before returning.
// Reply headers for a reply into an existing thread: the stored headers of the parent give the
// In-Reply-To and the References chain the SMTP message needs.
async function imapReplyHeaders(
  db: Db,
  accountId: string,
  parentProviderMessageId: string,
  signal: AbortSignal,
): Promise<{ inReplyTo?: string; references?: string }> {
  signal.throwIfAborted();
  const rows = (
    await db.execute(sql`
      SELECT h.rfc822_message_id, h.references
      FROM email_message_headers h
      JOIN email_messages m ON m.id = h.message_id AND m.account_id = h.account_id
      WHERE h.account_id=${accountId} AND m.provider_message_id=${parentProviderMessageId}
      LIMIT 1
    `)
  ).rows as { rfc822_message_id: string; references: string[] }[];
  const parent = rows[0];
  if (parent === undefined) return {};
  return {
    inReplyTo: parent.rfc822_message_id,
    references: [...parent.references, parent.rfc822_message_id].join(" "),
  };
}

async function markAuthFailure(db: Db, accountId: string, error: AppError): Promise<void> {
  if (error.id !== ERROR_IDS.MAIL_AUTH_FAILED) return;
  await db
    .update(emailAccounts)
    .set({ status: "error", lastErrorId: error.id })
    .where(eq(emailAccounts.id, accountId));
}

export function createImapProvider(
  db: Db,
  accountId: string,
  creds: MailCredentials,
  transports: MailTransportFactory,
  options: ImapProviderOptions = {},
): MailProvider {
  return {
    kind: "imap",

    async send(args) {
      const reply =
        args.parentProviderMessageId === null
          ? {}
          : await imapReplyHeaders(db, accountId, args.parentProviderMessageId, args.signal);
      return sendImapMessage({
        db,
        accountId,
        credentials: creds,
        transports,
        raw: args.raw,
        messageIdHeader: args.messageIdHeader,
        envelope: args.envelope,
        providerThreadId: args.providerThreadId,
        parentProviderMessageId: args.parentProviderMessageId,
        reply,
        attemptId: args.attemptId,
        signal: args.signal,
        ...(options.limits !== undefined ? { limits: options.limits } : {}),
      });
    },

    replyHeaders(args) {
      return imapReplyHeaders(db, accountId, args.parentProviderMessageId, args.signal);
    },

    async findSent(args) {
      const opened = await transports.openImap(creds.imap, args.signal);
      if (!opened.ok) return opened;
      try {
        const folder = await sentFolderPath(opened.value, args.signal);
        if (folder === null) return ok(null);
        const found = await opened.value.findByMessageId(folder, args.messageIdHeader, args.signal);
        if (!found.ok) return found;
        if (found.value.length === 0) return ok(null);
        return ok({
          providerMessageId: normalizeMessageId(args.messageIdHeader) ?? args.messageIdHeader,
        });
      } finally {
        await opened.value.close();
      }
    },

    async describeSent(args) {
      const rows = (
        await db.execute(sql`
          SELECT s.message_id_header, s.payload, s.thread_id, t.provider_thread_id
          FROM email_send_attempts s
          LEFT JOIN email_threads t ON t.id = s.thread_id AND t.account_id = s.account_id
          WHERE s.account_id=${accountId} AND lower(s.message_id_header) = lower(${args.providerMessageId})
          LIMIT 1
        `)
      ).rows as {
        message_id_header: string;
        payload: { text?: string; html?: string };
        thread_id: string | null;
        provider_thread_id: string | null;
      }[];
      const row = rows[0];
      if (row === undefined) {
        return err(
          new AppError(ERROR_IDS.MAIL_LOCATION_MISSING, "no send attempt for that message", {
            accountId,
          }),
        );
      }
      const headerRows = (
        await db.execute(sql`
          SELECT rfc822_message_id, in_reply_to, "references"
          FROM email_message_headers
          WHERE account_id=${accountId} AND (rfc822_message_id=${row.message_id_header}
            OR rfc822_message_id=${args.providerMessageId})
          LIMIT 1
        `)
      ).rows as { rfc822_message_id: string; in_reply_to: string | null; references: string[] }[];
      const header = headerRows[0];
      const text = (row.payload.text ?? "").replace(/\s+/g, " ").trim();
      return ok({
        providerMessageId: args.providerMessageId,
        providerThreadId: row.provider_thread_id ?? `imap:${row.message_id_header}`,
        snippet: text === "" ? null : text.slice(0, 200),
        headers: {
          rfc822MessageId: header?.rfc822_message_id ?? row.message_id_header,
          inReplyTo: header?.in_reply_to ?? null,
          references: header?.references ?? [],
        },
      });
    },

    async sync(signal) {
      const [account] = await db
        .select({
          id: emailAccounts.id,
          emailAddress: emailAccounts.emailAddress,
          userId: emailAccounts.userId,
        })
        .from(emailAccounts)
        .where(eq(emailAccounts.id, accountId))
        .limit(1);
      if (account === undefined) {
        return err(new AppError(ERROR_IDS.MAIL_CONNECT_FAILED, "mailbox not found", { accountId }));
      }

      const opened = await transports.openImap(creds.imap, signal);
      if (!opened.ok) {
        await markAuthFailure(db, accountId, opened.error);
        return opened;
      }
      try {
        const owner = await hydrateOwner(db, account.userId, signal);
        if (!owner.ok) return owner;
        return await syncImapAccount(db, {
          account: { id: account.id, emailAddress: account.emailAddress },
          owner: owner.value,
          session: opened.value,
          signal,
        });
      } finally {
        await opened.value.close();
      }
    },

    async fetchAttachment(args) {
      const opened = await transports.openImap(creds.imap, args.signal);
      if (!opened.ok) return opened;
      try {
        return await fetchImapAttachment({
          db,
          accountId,
          session: opened.value,
          providerMessageId: args.providerMessageId,
          providerAttachmentId: args.providerAttachmentId,
          signal: args.signal,
        });
      } finally {
        await opened.value.close();
      }
    },

    async trashThread(args) {
      const opened = await transports.openImap(creds.imap, args.signal);
      if (!opened.ok) return opened;
      try {
        return await trashImapThread({
          db,
          accountId,
          session: opened.value,
          providerThreadId: args.providerThreadId,
          signal: args.signal,
        });
      } finally {
        await opened.value.close();
      }
    },
    close: () => Promise.resolve(),
  };
}
