import type { Db } from "@/db/client";
import type { GmailClient } from "@/features/email/gmailClient";
import type { GmailMessage } from "@/features/email/gmailSchemas";
import { toRawBase64 } from "@/features/email/mime";
import { type ReplyThreadHeaders, replyThreadHeaders } from "@/features/email/replyHeaders";
import { syncMailbox } from "@/features/email/sync";
import { ok } from "@/types/result";
import type { MailProvider, SentMessage } from "./types";

// Reads one RFC 822 header out of a Gmail message payload. Header names are case-insensitive.
function headerOf(message: GmailMessage, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const header of message.payload?.headers ?? []) {
    if (header.name.toLowerCase() === wanted) return header.value.trim();
  }
  return null;
}

function referencesFromChain(chain: string | null): string[] {
  if (chain === null || chain === "") return [];
  return chain.split(/\s+/).filter((part) => part !== "");
}

function headersOf(message: GmailMessage): SentMessage["headers"] {
  return {
    rfc822MessageId: headerOf(message, "Message-ID") ?? "",
    inReplyTo: headerOf(message, "In-Reply-To"),
    references: referencesFromChain(headerOf(message, "References")),
  };
}

async function parentThreadHeaders(
  gmail: GmailClient,
  parentProviderMessageId: string | null,
  signal: AbortSignal,
): Promise<ReplyThreadHeaders> {
  if (parentProviderMessageId === null) return {};
  const parent = await gmail.getMessage({ id: parentProviderMessageId, signal });
  signal.throwIfAborted();
  if (!parent.ok) return {};
  return replyThreadHeaders(parent.value);
}

// The Gmail implementation of MailProvider. It wraps the existing client and the existing sync
// engine unchanged, so Gmail behaviour stays exactly what Part 1 shipped.
export function createGmailProvider(db: Db, accountId: string, gmail: GmailClient): MailProvider {
  return {
    kind: "gmail",

    sync: (signal) => syncMailbox(db, { accountId, gmail, signal }),

    async send(args) {
      const sent = await gmail.sendRaw({
        rawBase64: toRawBase64(args.raw),
        ...(args.providerThreadId !== null ? { threadId: args.providerThreadId } : {}),
        signal: args.signal,
      });
      if (!sent.ok) return sent;

      // The send call only returns ids, so one metadata read supplies the thread id and snippet
      // the outbound copy stores. A failure here is reported: the caller reconciles by Message-ID.
      const fetched = await gmail.getMessage({ id: sent.value.id, signal: args.signal });
      if (!fetched.ok) return fetched;

      const thread = await parentThreadHeaders(gmail, args.parentProviderMessageId, args.signal);
      return ok({
        providerMessageId: sent.value.id,
        providerThreadId: fetched.value.threadId,
        snippet: fetched.value.snippet ?? null,
        headers: {
          rfc822MessageId: args.messageIdHeader,
          inReplyTo: thread.inReplyTo ?? null,
          references: referencesFromChain(thread.references ?? null),
        },
      });
    },

    async describeSent(args) {
      const fetched = await gmail.getMessage({ id: args.providerMessageId, signal: args.signal });
      if (!fetched.ok) return fetched;
      return ok({
        providerMessageId: fetched.value.id,
        providerThreadId: fetched.value.threadId,
        snippet: fetched.value.snippet ?? null,
        headers: headersOf(fetched.value),
      });
    },

    async findSent(args) {
      const hits = await gmail.searchByRfc822({
        messageIdHeader: args.messageIdHeader,
        signal: args.signal,
      });
      if (!hits.ok) return hits;
      const first = hits.value.messages[0];
      return ok(first === undefined ? null : { providerMessageId: first.id });
    },

    async replyHeaders(args) {
      return parentThreadHeaders(gmail, args.parentProviderMessageId, args.signal);
    },

    async fetchAttachment(args) {
      const attachment = await gmail.getAttachment({
        messageId: args.providerMessageId,
        attachmentId: args.providerAttachmentId,
        signal: args.signal,
      });
      if (!attachment.ok) return attachment;
      return ok({ bytes: Buffer.from(attachment.value.dataBase64, "base64url") });
    },

    async trashThread(args) {
      const trashed = await gmail.trashThread({
        threadId: args.providerThreadId,
        signal: args.signal,
      });
      if (!trashed.ok) return trashed;
      return ok(undefined);
    },

    close: () => Promise.resolve(),
  };
}

// Test seam: the adapter needs no database for send, describe, find, reply or attachment calls.
export function gmailProviderForTest(db: Db, accountId: string, gmail: GmailClient): MailProvider {
  return createGmailProvider(db, accountId, gmail);
}
