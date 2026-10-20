import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { mailAccountCredentials } from "@/db/schema";
import { createGmailClient, type GmailClient } from "@/features/email/gmailClient";
import { makeRefresh } from "@/features/email/gmailRefresh";
import { ensureAccessToken } from "@/features/email/tokens";
import { err, ok, type Result } from "@/types/result";
import { loadImapCredentials } from "../connect/credentials";
import { getMailTransportFactory } from "../transport/factory";
import type { MailTransportFactory } from "../transport/types";
import { createGmailProvider } from "./gmailAdapter";
import { createImapProvider } from "./imapProvider";
import type { MailProvider } from "./types";

// Injectable pieces so tests can supply a fake client or fake transports without real I/O.
export interface ResolveDeps {
  gmailClient?: (accountId: string, signal: AbortSignal) => Promise<Result<GmailClient, AppError>>;
  transports?: MailTransportFactory;
}

async function defaultGmailClient(
  db: Db,
  accountId: string,
  signal: AbortSignal,
): Promise<Result<GmailClient, AppError>> {
  signal.throwIfAborted();
  const token = await ensureAccessToken(db, { accountId, deps: { refresh: makeRefresh(signal) } });
  if (!token.ok) return token;
  return ok(createGmailClient(token.value.token));
}

// A mailbox is IMAP when it has a credentials row, otherwise Gmail.
export async function resolveMailProvider(
  db: Db,
  accountId: string,
  signal: AbortSignal,
  deps: ResolveDeps = {},
): Promise<Result<MailProvider, AppError>> {
  signal.throwIfAborted();
  const [credentials] = await db
    .select({ accountId: mailAccountCredentials.accountId })
    .from(mailAccountCredentials)
    .where(eq(mailAccountCredentials.accountId, accountId))
    .limit(1);
  if (credentials !== undefined) {
    const loaded = await loadImapCredentials(db, accountId, signal);
    if (!loaded.ok) return loaded;
    if (loaded.value === null) {
      return err(new AppError(ERROR_IDS.MAIL_CREDENTIALS_UNREADABLE, "mailbox has no credentials"));
    }
    return ok(
      createImapProvider(db, accountId, loaded.value, deps.transports ?? getMailTransportFactory()),
    );
  }

  const resolver = deps.gmailClient ?? ((id, s) => defaultGmailClient(db, id, s));
  const client = await resolver(accountId, signal);
  if (!client.ok) return client;
  return ok(createGmailProvider(db, accountId, client.value));
}
