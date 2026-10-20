import { eq, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { PGBOSS_QUEUE_MAIL_APPEND } from "@/constants/jobNames";
import { MAIL_APPEND_MAX_TRIES } from "@/constants/mail";
import type { Db } from "@/db/client";
import { mailSentAppends } from "@/db/schema";
import { buildMime, type MimeAttachment } from "@/features/email/mime";
import type { SendPayload } from "@/features/email/outboxClaim";
import { makeStorageClient } from "@/features/files/storage";
import { ok, type Result } from "@/types/result";
import { loadImapCredentials } from "../connect/credentials";
import { getMailTransportFactory } from "../transport/factory";
import type { ImapSession, MailTransportFactory } from "../transport/types";
import { upsertLocation } from "./locations";
import { sentFolderPath } from "./send";

// A copy waiting for APPEND is recorded before the append so a crash still leaves a retryable
// row. Purelymail does not save SMTP-sent mail itself, so this is the only Sent copy.
export async function recordAppendAttempt(
  db: Db,
  attemptId: string,
  accountId: string,
): Promise<void> {
  await db
    .insert(mailSentAppends)
    .values({ attemptId, accountId, status: "pending" })
    .onConflictDoNothing();
}

// Count one failed APPEND attempt, including the ones that never reached the server (no Sent
// folder, no session, bad credentials), so a row always reaches got_up instead of retrying forever.
async function bumpTriesById(db: Db, attemptId: string, errorId: string): Promise<void> {
  await db
    .update(mailSentAppends)
    .set({
      tries: sql`${mailSentAppends.tries} + 1`,
      lastErrorId: errorId,
      updatedAt: new Date(),
    })
    .where(eq(mailSentAppends.attemptId, attemptId));
}

async function setAppendState(
  db: Db,
  attemptId: string,
  state: { status?: "done" | "gave_up"; tries?: number; lastErrorId?: string | null },
): Promise<void> {
  await db
    .update(mailSentAppends)
    .set({ ...state, updatedAt: new Date() })
    .where(eq(mailSentAppends.attemptId, attemptId));
}

export interface AppendArgs {
  db: Db;
  session: ImapSession;
  attemptId: string;
  accountId: string;
  providerMessageId: string;
  raw: string;
  signal: AbortSignal;
}

// Append the full message (Bcc included; this copy is ours) with \Seen. A failure only records
// the attempt for retry: the SMTP send already happened and must not be reported as failed.
export async function appendToSent(args: AppendArgs): Promise<boolean> {
  const folder = await sentFolderPath(args.session, args.signal);
  if (folder === null) {
    await bumpTriesById(args.db, args.attemptId, ERROR_IDS.MAIL_APPEND_FAILED);
    return false;
  }
  const appended = await args.session.append(
    folder,
    Buffer.from(args.raw),
    ["\\Seen"],
    args.signal,
  );
  if (!appended.ok) {
    await bumpTriesById(args.db, args.attemptId, appended.error.id);
    return false;
  }
  await setAppendState(args.db, args.attemptId, { status: "done", lastErrorId: null });
  if (appended.value.uid !== null && appended.value.uidValidity !== null) {
    await upsertLocation(args.db, {
      accountId: args.accountId,
      folder,
      uidValidity: appended.value.uidValidity,
      uid: appended.value.uid,
      providerMessageId: args.providerMessageId,
    });
  }
  return true;
}

interface PendingAppend {
  attemptId: string;
  accountId: string;
  messageIdHeader: string;
  payload: SendPayload;
  threadId: string | null;
  providerMessageId: string | null;
  emailAddress: string;
  tries: number;
}

async function pendingAppends(db: Db): Promise<PendingAppend[]> {
  const rows = (
    await db.execute(sql`
      SELECT p.attempt_id, p.tries, s.account_id, s.message_id_header, s.payload, s.thread_id,
        s.provider_message_id, a.email_address
      FROM mail_sent_appends p
      JOIN email_send_attempts s ON s.id = p.attempt_id
      JOIN email_accounts a ON a.id = s.account_id
      WHERE p.status = 'pending' AND p.tries < ${MAIL_APPEND_MAX_TRIES}
      ORDER BY p.updated_at
      LIMIT 50
    `)
  ).rows as {
    attempt_id: string;
    tries: number;
    account_id: string;
    message_id_header: string;
    payload: SendPayload;
    thread_id: string | null;
    provider_message_id: string | null;
    email_address: string;
  }[];
  return rows.map((row) => ({
    attemptId: row.attempt_id,
    accountId: row.account_id,
    messageIdHeader: row.message_id_header,
    payload: row.payload,
    threadId: row.thread_id,
    providerMessageId: row.provider_message_id,
    emailAddress: row.email_address,
    tries: row.tries,
  }));
}

// Reply headers for a rebuilt message: the newest stored message in the thread that is not this
// send is the parent, and its headers give In-Reply-To and the References chain.
async function rebuiltReplyHeaders(
  db: Db,
  append: PendingAppend,
): Promise<{ inReplyTo?: string; references?: string }> {
  if (append.threadId === null) return {};
  const rows = (
    await db.execute(sql`
      SELECT h.rfc822_message_id, h.references
      FROM email_message_headers h
      JOIN email_messages m ON m.id = h.message_id
      WHERE m.thread_id = ${append.threadId}
        AND (${append.providerMessageId}::text IS NULL OR m.provider_message_id <> ${append.providerMessageId})
      ORDER BY m.sent_at DESC NULLS LAST, m.created_at DESC
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

async function attachmentBytes(
  payload: SendPayload,
  signal: AbortSignal,
): Promise<MimeAttachment[]> {
  const storage = makeStorageClient();
  const out: MimeAttachment[] = [];
  for (const attachment of payload.attachments ?? []) {
    const bytes = await storage.getObjectBytes(attachment.s3Key, signal);
    if (!bytes.ok) throw new AppError(bytes.error.id, "attachment fetch failed", {});
    out.push({
      filename: attachment.filename,
      contentType: attachment.contentType,
      bytes: bytes.value,
    });
  }
  return out;
}

async function bumpTries(
  db: Db,
  append: PendingAppend,
  errorId: string,
): Promise<"gaveUp" | "skipped"> {
  const tries = append.tries + 1;
  const gaveUp = tries >= MAIL_APPEND_MAX_TRIES;
  await db
    .update(mailSentAppends)
    .set({ tries, lastErrorId: errorId, ...(gaveUp ? { status: "gave_up" as const } : {}) })
    .where(eq(mailSentAppends.attemptId, append.attemptId));
  return gaveUp ? "gaveUp" : "skipped";
}

async function retryOne(
  db: Db,
  append: PendingAppend,
  transports: MailTransportFactory,
  signal: AbortSignal,
): Promise<"done" | "gaveUp" | "skipped"> {
  const credentials = await loadImapCredentials(db, append.accountId, signal);
  if (!credentials.ok) return bumpTries(db, append, credentials.error.id);
  if (credentials.value === null) {
    return bumpTries(db, append, ERROR_IDS.MAIL_CREDENTIALS_UNREADABLE);
  }
  const opened = await transports.openImap(credentials.value.imap, signal);
  if (!opened.ok) return bumpTries(db, append, opened.error.id);
  try {
    const attachments = await attachmentBytes(append.payload, signal).catch(() => null);
    if (attachments === null) return bumpTries(db, append, ERROR_IDS.MAIL_APPEND_FAILED);
    const reply = await rebuiltReplyHeaders(db, append);
    const raw = buildMime({
      from: append.emailAddress,
      to: append.payload.to,
      cc: append.payload.cc,
      bcc: append.payload.bcc,
      subject: append.payload.subject,
      html: append.payload.html,
      text: append.payload.text,
      messageId: append.messageIdHeader,
      inReplyTo: reply.inReplyTo,
      references: reply.references,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    const sentFolder = await sentFolderPath(opened.value, signal);
    if (sentFolder === null) return bumpTries(db, append, ERROR_IDS.MAIL_APPEND_FAILED);
    const appended = await opened.value.append(sentFolder, Buffer.from(raw), ["\\Seen"], signal);
    if (!appended.ok) return bumpTries(db, append, appended.error.id);

    await setAppendState(db, append.attemptId, { status: "done", lastErrorId: null });
    if (
      append.providerMessageId !== null &&
      appended.value.uid !== null &&
      appended.value.uidValidity !== null
    ) {
      await upsertLocation(db, {
        accountId: append.accountId,
        folder: sentFolder,
        uidValidity: appended.value.uidValidity,
        uid: appended.value.uid,
        providerMessageId: append.providerMessageId,
      });
    }
    return "done";
  } finally {
    await opened.value.close();
  }
}

// Retry every pending append. Rebuilds the MIME from the stored payload and the fixed Message-ID,
// so the copy is the message that went out; gives up after MAIL_APPEND_MAX_TRIES.
export async function runAppendRetryJob(
  db: Db,
  signal: AbortSignal,
  deps: { transports?: MailTransportFactory } = {},
): Promise<Result<{ retried: number; done: number; gaveUp: number }, AppError>> {
  const pending = await pendingAppends(db);
  const transports = deps.transports ?? getMailTransportFactory();
  let done = 0;
  let gaveUp = 0;
  for (const append of pending) {
    signal.throwIfAborted();
    const outcome = await retryOne(db, append, transports, signal);
    if (outcome === "done") done += 1;
    if (outcome === "gaveUp") gaveUp += 1;
  }
  return ok({ retried: pending.length, done, gaveUp });
}

// Retry queue, scheduled every five minutes. The handler never throws for a single mailbox: the
// next tick tries again, and a row at the limit is marked gave_up.
export async function registerMailAppendWorker(boss: PgBoss): Promise<void> {
  const { db } = await import("@/db/client");
  await boss.createQueue(PGBOSS_QUEUE_MAIL_APPEND);
  await boss.schedule(PGBOSS_QUEUE_MAIL_APPEND, "*/5 * * * *");
  await boss.work(PGBOSS_QUEUE_MAIL_APPEND, async () => {
    const signal = AbortSignal.timeout(120_000);
    const result = await runAppendRetryJob(db, signal);
    if (!result.ok) console.warn("[mail.append] retry job failed", { errorId: result.error.id });
  });
}
