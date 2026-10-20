import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { hydrateOwner } from "@/features/email/syncCursor";
import { err, type Result } from "@/types/result";
import type { MailCredentials } from "../connect/credentials";
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

    send: unsupported,
    describeSent: unsupported,
    findSent: unsupported,
    replyHeaders: () => Promise.resolve({}),
    fetchAttachment: unsupported,
    trashThread: unsupported,
    close: () => Promise.resolve(),
  };
}
