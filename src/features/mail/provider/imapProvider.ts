import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { hydrateOwner } from "@/features/email/syncCursor";
import { err, type Result } from "@/types/result";
import type { MailCredentials } from "../connect/credentials";
import { sendImapMessage } from "../imap/send";
import { syncImapAccount } from "../imap/sync";
import type { MailTransportFactory } from "../transport/types";
import type { MailProvider } from "./types";

export interface ImapProviderOptions {
  // Tests pass small limits; production uses the env defaults (Task 4.3).
  limits?: { dailyRecipients?: number; maxRecipients?: number };
}

// The IMAP implementation is built up over Tasks 3.3 to 4.4. Until then every method reports
// E_MAIL_015 so resolveMailProvider can already return kind "imap" and the connect flow can be
// proved end to end without pretending to sync.
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
  void options;
  const unsupported = (): Promise<Result<never, AppError>> =>
    Promise.resolve(
      err(new AppError(ERROR_IDS.MAIL_UNSUPPORTED, "imap provider not wired yet", { accountId })),
    );
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

    describeSent: unsupported,
    findSent: unsupported,
    replyHeaders: () => Promise.resolve({}),
    fetchAttachment: unsupported,
    trashThread: unsupported,
    close: () => Promise.resolve(),
  };
}
