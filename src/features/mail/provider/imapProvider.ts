import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, type Result } from "@/types/result";
import type { MailCredentials } from "../connect/credentials";
import type { MailTransportFactory } from "../transport/types";
import type { MailProvider } from "./types";

export interface ImapProviderOptions {
  // Tests pass small limits; production uses the env defaults (Task 4.3).
  limits?: { dailyRecipients?: number; maxRecipients?: number };
}

// The IMAP implementation is built up over Tasks 3.3 to 4.4. Until then every method reports
// E_MAIL_015 so resolveMailProvider can already return kind "imap" and the connect flow can be
// proved end to end without pretending to sync.
export function createImapProvider(
  db: Db,
  accountId: string,
  creds: MailCredentials,
  transports: MailTransportFactory,
  options: ImapProviderOptions = {},
): MailProvider {
  void db;
  void creds;
  void transports;
  void options;
  const unsupported = (): Promise<Result<never, AppError>> =>
    Promise.resolve(
      err(new AppError(ERROR_IDS.MAIL_UNSUPPORTED, "imap provider not wired yet", { accountId })),
    );
  return {
    kind: "imap",
    sync: unsupported,
    send: unsupported,
    describeSent: unsupported,
    findSent: unsupported,
    replyHeaders: () => Promise.resolve({}),
    fetchAttachment: unsupported,
    trashThread: unsupported,
    close: () => Promise.resolve(),
  };
}
