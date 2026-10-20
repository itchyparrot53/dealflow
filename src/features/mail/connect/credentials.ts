import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { mailAccountCredentials } from "@/db/schema";
import { decryptToken } from "@/features/email/crypto";
import { err, ok, type Result } from "@/types/result";
import type { ImapCredentials, SmtpCredentials } from "../transport/types";

export interface MailCredentials {
  imap: ImapCredentials;
  smtp: SmtpCredentials;
}

// Loads the decrypted IMAP/SMTP credentials for an account. The password exists in memory only
// inside this call's result: never log it, never put it in an error context.
export async function loadImapCredentials(
  db: Db,
  accountId: string,
  signal: AbortSignal,
): Promise<Result<MailCredentials | null, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(mailAccountCredentials)
    .where(eq(mailAccountCredentials.accountId, accountId))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) return ok(null);

  const password = decryptToken(Buffer.from(row.passwordEnc));
  if (!password.ok) {
    return err(
      new AppError(ERROR_IDS.MAIL_CREDENTIALS_UNREADABLE, "mail password could not be decrypted", {
        accountId,
      }),
    );
  }
  return ok({
    imap: {
      host: row.imapHost,
      port: row.imapPort,
      secure: row.imapSecure,
      username: row.username,
      password: password.value,
    },
    smtp: {
      host: row.smtpHost,
      port: row.smtpPort,
      secure: row.smtpSecure,
      username: row.username,
      password: password.value,
    },
  });
}
