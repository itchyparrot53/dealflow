import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { type DealArrival, storeInboundMessage } from "@/features/mail/inbound/storeInbound";
import type { ParsedMailMessage } from "@/features/mail/parse/types";
import { notifyDealEmailReceived } from "@/features/notifications/wire";
import type { AuthUser } from "@/features/permissions/types";
import { ok, type Result } from "@/types/result";
import type { GmailClient } from "./gmailClient";
import { messageGoneFromMailbox } from "./messageGone";
import { type ParsedGmailMessage, parseGmailMessage } from "./mimeParse";

// Gmail's parsed message in the provider-neutral shape the shared inbound store expects. Gmail
// history replays messages we SENT as messagesAdded, so everything is mapped as inbound; the
// shared store tells a self-sent message by the account address, exactly as before.
export function toParsedMailMessage(parsed: ParsedGmailMessage): ParsedMailMessage {
  return {
    providerMessageId: parsed.providerMessageId,
    rfc822MessageId: parsed.rfc822MessageId,
    inReplyTo: parsed.inReplyTo,
    references: parsed.references,
    fromEmail: parsed.fromEmail,
    fromName: parsed.fromName,
    toEmails: parsed.toEmails,
    ccEmails: parsed.ccEmails,
    subject: parsed.subject,
    snippet: parsed.snippet,
    bodyHtml: parsed.bodyHtml,
    bodyText: parsed.bodyText,
    sentAt: parsed.sentAt,
    participants: parsed.participants,
    direction: "inbound",
    attachments: parsed.attachments,
  };
}

// Apply a list of gmail message ids: fetch + parse each, then store it through the shared
// inbound store (thread upsert, link, message, attachments, headers, realtime event) in one
// transaction per message. Idempotent: a redelivered id writes nothing and emits nothing.
export async function applyMessageIds(
  args: {
    db: Db;
    accountId: string;
    owner: AuthUser;
    gmail: GmailClient;
    signal: AbortSignal;
    // When provided, the gmail THREAD id of every added message is collected here so the caller can
    // re-evaluate each touched thread's whole-thread trash state (P4). Both directions need it: a
    // new message arriving already in TRASH (a Gmail filter with "Delete it") should trash the
    // thread, and a new inbox message on a previously-trashed thread (a reply) should un-trash it,
    // and the added message's own label does not distinguish those, so ALL touched threads reconcile.
    touchedThreadIds?: Set<string>;
  },
  ids: string[],
): Promise<Result<number, AppError>> {
  args.signal.throwIfAborted();
  let applied = 0;

  // Deal-linked arrivals, collected inside the loop and notified after every tx has committed
  // so a notification never outlives a rolled-back message insert.
  const arrivals: DealArrival[] = [];

  for (const id of ids) {
    const fetched = await args.gmail.getMessage({ id, signal: args.signal });
    args.signal.throwIfAborted();
    if (!fetched.ok) {
      // A 404 means the message is gone from the mailbox (permanently deleted between the history
      // entry naming it and this fetch). There is nothing to store and no later tick can fetch it,
      // so skip it and let the page finish. Returning here instead wedged the cursor: the page
      // never completed, so sync_cursor never advanced, so every following tick re-listed the
      // same page, re-fetched the same dead id, and took the same 404. That is how one deleted
      // message stopped a mailbox syncing for eight hours. applyTrashTransitions already treats a
      // getThread 404 the same way, for the same reason.
      if (messageGoneFromMailbox(fetched.error)) continue;
      return fetched;
    }
    const parsed = parseGmailMessage(fetched.value);
    args.touchedThreadIds?.add(parsed.threadId);

    const stored = await args.db.transaction((tx) =>
      storeInboundMessage(tx, {
        accountId: args.accountId,
        owner: args.owner,
        providerThreadId: parsed.threadId,
        parsed: toParsedMailMessage(parsed),
        signal: args.signal,
      }),
    );

    if (stored.inserted) applied += 1;
    if (stored.arrival !== null) arrivals.push(stored.arrival);
  }

  await notifyArrivals(args.db, arrivals, args.signal);

  return ok(applied);
}

// Best-effort, after every message tx has committed: a notification failure must never
// undo an applied message or abort the rest of the sync page.
async function notifyArrivals(db: Db, arrivals: DealArrival[], signal: AbortSignal): Promise<void> {
  for (const arrival of arrivals) {
    try {
      await notifyDealEmailReceived(db, { ...arrival, signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      console.warn("notifyDealEmailReceived failed (best-effort)", {
        messageId: arrival.messageId,
        err,
      });
    }
  }
}
