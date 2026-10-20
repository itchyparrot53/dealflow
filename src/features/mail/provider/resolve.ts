import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { mailAccountCredentials } from "@/db/schema";
import { createGmailClient, type GmailClient } from "@/features/email/gmailClient";
import { makeRefresh } from "@/features/email/gmailRefresh";
import { ensureAccessToken } from "@/features/email/tokens";
import { err, ok, type Result } from "@/types/result";
import { createGmailProvider } from "./gmailAdapter";
import type { MailProvider } from "./types";

// Injectable pieces so tests can supply a fake client without a token refresh. `transports` is
// added in Task 2.4, when the IMAP provider and its factory exist.
export interface ResolveDeps {
  gmailClient?: (accountId: string, signal: AbortSignal) => Promise<Result<GmailClient, AppError>>;
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

// A mailbox is IMAP when it has a credentials row, otherwise Gmail. The IMAP provider arrives in
// Task 2.4; until then that branch reports E_MAIL_015 instead of silently falling back to Gmail.
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
    return err(new AppError(ERROR_IDS.MAIL_UNSUPPORTED, "imap provider not wired yet"));
  }

  const resolver = deps.gmailClient ?? ((id, s) => defaultGmailClient(db, id, s));
  const client = await resolver(accountId, signal);
  if (!client.ok) return client;
  return ok(createGmailProvider(db, accountId, client.value));
}
