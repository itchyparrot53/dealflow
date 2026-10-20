import { sql } from "drizzle-orm";
import { AppError } from "@/constants/errorIds";
import { wsChannel } from "@/constants/wsChannels";
import { resolveLink } from "@/features/email/linking";
import type { ParsedMailMessage } from "@/features/mail/parse/types";
import type { AuthUser } from "@/features/permissions/types";
import { publishEvent } from "@/server/notify";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// The arrival information the caller needs to notify a linked deal AFTER the transaction
// commits. Returning it keeps the notification out of the transaction while the decision
// (linked deal, not self-sent) is made here, next to the write it describes.
export interface DealArrival {
  dealId: string;
  threadId: string;
  messageId: string;
  subject: string | null;
  fromEmail: string;
}

export interface StoredInbound {
  inserted: boolean;
  messageRowId: string;
  threadId: string;
  arrival: DealArrival | null;
}

export interface StoreInboundArgs {
  accountId: string;
  owner: AuthUser;
  providerThreadId: string;
  parsed: ParsedMailMessage;
  signal: AbortSignal;
}

// Store one parsed message inside the caller's transaction: upsert the thread (and link a new
// one), insert the message and its attachments and headers, publish email_arrived, and report a
// deal arrival. Idempotent on (account_id, provider_message_id): a redelivered message writes
// nothing and emits nothing.
export async function storeInboundMessage(
  tx: DbOrTx,
  args: StoreInboundArgs,
): Promise<StoredInbound> {
  args.signal.throwIfAborted();
  const thread = await upsertThread(tx, args, args.providerThreadId, args.parsed);

  const inserted = await tx.execute(sql`
    INSERT INTO email_messages
      (thread_id, account_id, provider_message_id, direction, from_email, from_name, to_emails, cc_emails, subject, snippet, body_html, body_text, sent_at)
    VALUES (
      ${thread.id}, ${args.accountId}, ${args.parsed.providerMessageId}, ${args.parsed.direction},
      ${args.parsed.fromEmail}, ${args.parsed.fromName},
      ${JSON.stringify(args.parsed.toEmails)}::jsonb, ${JSON.stringify(args.parsed.ccEmails)}::jsonb,
      ${args.parsed.subject}, ${args.parsed.snippet}, ${args.parsed.bodyHtml},
      ${args.parsed.bodyText}, ${args.parsed.sentAt}
    )
    ON CONFLICT (account_id, provider_message_id) DO NOTHING
    RETURNING id
  `);
  const row = inserted.rows[0] as { id: string } | undefined;
  if (row === undefined) {
    // Already applied: report the existing row so the caller can still use the id, but emit no
    // event and no arrival notification.
    const existing = await tx.execute(sql`
      SELECT id FROM email_messages
      WHERE account_id=${args.accountId} AND provider_message_id=${args.parsed.providerMessageId}
    `);
    const found = existing.rows[0] as { id: string } | undefined;
    if (found === undefined) {
      throw new AppError("E_DB_002", "inbound message conflict without a row", {
        accountId: args.accountId,
      });
    }
    return { inserted: false, messageRowId: found.id, threadId: thread.id, arrival: null };
  }

  for (const attachment of args.parsed.attachments) {
    await tx.execute(sql`
      INSERT INTO email_message_attachments (message_id, account_id, provider_attachment_id, filename, mime_type, size_bytes)
      VALUES (${row.id}, ${args.accountId}, ${attachment.providerAttachmentId}, ${attachment.filename}, ${attachment.mimeType}, ${attachment.sizeBytes})
    `);
  }

  if (args.parsed.rfc822MessageId !== "") {
    await tx.execute(sql`
      INSERT INTO email_message_headers (message_id, account_id, rfc822_message_id, in_reply_to, "references")
      VALUES (
        ${row.id}, ${args.accountId}, ${args.parsed.rfc822MessageId}, ${args.parsed.inReplyTo},
        ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(args.parsed.references)}::jsonb))
      )
      ON CONFLICT (message_id) DO NOTHING
    `);
  }

  // Publish in the SAME tx so a rollback emits nothing (ops A4). Ids only.
  await publishEvent(
    tx,
    {
      v: 1,
      channel: wsChannel.user(args.owner.id),
      ts: new Date().toISOString(),
      actorId: null,
      type: "email_arrived",
      data: { messageId: row.id, threadId: thread.id, accountId: args.accountId },
    },
    args.signal,
  );

  const ownAddress = await mailboxAddress(tx, args.accountId, args.signal);
  const arrival =
    thread.dealId !== null && !isSelfSent(args.parsed.fromEmail, ownAddress)
      ? {
          dealId: thread.dealId,
          threadId: thread.id,
          messageId: row.id,
          subject: args.parsed.subject,
          fromEmail: args.parsed.fromEmail,
        }
      : null;

  return { inserted: true, messageRowId: row.id, threadId: thread.id, arrival };
}

function isSelfSent(fromEmail: string, ownAddress: string | null): boolean {
  if (ownAddress === null) return false;
  return fromEmail.trim().toLowerCase() === ownAddress.trim().toLowerCase();
}

// The address this mailbox sends from. Null when the account row is gone, in which case the
// self-sent check simply does not fire.
async function mailboxAddress(
  db: DbOrTx,
  accountId: string,
  signal: AbortSignal,
): Promise<string | null> {
  signal.throwIfAborted();
  const rows = await db.execute(
    sql`SELECT email_address FROM email_accounts WHERE id = ${accountId}`,
  );
  const row = rows.rows[0] as { email_address: string } | undefined;
  return row?.email_address ?? null;
}

// Upsert the thread on (account_id, provider_thread_id). On a NEW thread, run resolveLink
// to set person_id/deal_id scoped to the owner's visibility. Returns the internal id.
async function upsertThread(
  tx: DbOrTx,
  args: { accountId: string; owner: AuthUser; signal: AbortSignal },
  providerThreadId: string,
  parsed: {
    subject: string | null;
    fromEmail: string;
    participants: string[];
    sentAt: Date | null;
  },
): Promise<{ id: string; dealId: string | null }> {
  const existing = await tx.execute(
    sql`SELECT id, deal_id FROM email_threads WHERE account_id=${args.accountId} AND provider_thread_id=${providerThreadId}`,
  );
  const found = existing.rows[0] as { id: string; deal_id: string | null } | undefined;
  if (found !== undefined) {
    // Advance last_message_at so a reply reorders the inbox (listInbox sorts by it DESC).
    // GREATEST keeps the newest time and tolerates a null column or a null parsed date (F30).
    if (parsed.sentAt !== null) {
      await tx.execute(sql`
        UPDATE email_threads
        SET last_message_at = GREATEST(last_message_at, ${parsed.sentAt}), updated_at = now()
        WHERE id = ${found.id}
      `);
    }
    return { id: found.id, dealId: found.deal_id };
  }

  const link = await resolveLink(
    tx,
    { owner: args.owner, participants: parsed.participants, fromEmail: parsed.fromEmail },
    args.signal,
  );
  const personId = link.kind === "linked" ? link.personId : null;
  const dealId = link.kind === "linked" ? link.dealId : null;

  const created = await tx.execute(sql`
    INSERT INTO email_threads (provider_thread_id, account_id, subject, person_id, deal_id, last_message_at)
    VALUES (${providerThreadId}, ${args.accountId}, ${parsed.subject}, ${personId}, ${dealId}, ${parsed.sentAt})
    ON CONFLICT (account_id, provider_thread_id) DO UPDATE SET updated_at=now()
    RETURNING id, deal_id
  `);
  // deal_id comes from RETURNING, not from the local variable: on the DO UPDATE path the row
  // was inserted concurrently and its stored link is the one that counts.
  const row = created.rows[0] as { id: string; deal_id: string | null } | undefined;
  if (row === undefined) {
    throw new AppError("E_DB_002", "email_threads upsert returned no row", { providerThreadId });
  }
  return { id: row.id, dealId: row.deal_id };
}
