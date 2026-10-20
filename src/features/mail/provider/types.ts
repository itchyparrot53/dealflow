import type { AppError } from "@/constants/errorIds";
import type { ReplyThreadHeaders } from "@/features/email/replyHeaders";
import type { Result } from "@/types/result";

// One sent message as the provider sees it. `headers` is what the outbound copy needs for the
// RFC 822 threading columns, independent of the provider's own thread model.
export interface SentMessage {
  providerMessageId: string;
  providerThreadId: string;
  snippet: string | null;
  headers: { rfc822MessageId: string; inReplyTo: string | null; references: string[] };
}

// Provider-neutral mail surface. Every send, sync, attachment, reconcile and trash path goes
// through this, so the Gmail client and the IMAP/SMTP implementation are interchangeable.
export interface MailProvider {
  readonly kind: "gmail" | "imap";
  // Pull new mail into email_threads/email_messages. Idempotent; advances cursors only after success.
  sync(signal: AbortSignal): Promise<Result<{ applied: number }, AppError>>;
  // Deliver one RFC 822 message. `raw` contains every header including Bcc; the provider decides
  // what goes on the wire.
  send(args: {
    raw: string;
    messageIdHeader: string;
    envelope: { from: string; to: string[] }; // to = to + cc + bcc
    providerThreadId: string | null; // existing thread for a reply
    parentProviderMessageId: string | null;
    attemptId: string;
    signal: AbortSignal;
  }): Promise<Result<SentMessage, AppError>>;
  // Describe an already-sent message by id (replay repair after a crash between send and store).
  describeSent(args: {
    providerMessageId: string;
    signal: AbortSignal;
  }): Promise<Result<SentMessage, AppError>>;
  // Reconcile an attempt whose outcome is unknown: was a message with this Message-ID sent?
  findSent(args: {
    messageIdHeader: string;
    signal: AbortSignal;
  }): Promise<Result<{ providerMessageId: string } | null, AppError>>;
  replyHeaders(args: {
    parentProviderMessageId: string;
    signal: AbortSignal;
  }): Promise<ReplyThreadHeaders>;
  fetchAttachment(args: {
    providerMessageId: string;
    providerAttachmentId: string;
    signal: AbortSignal;
  }): Promise<Result<{ bytes: Buffer }, AppError>>;
  trashThread(args: {
    providerThreadId: string;
    signal: AbortSignal;
  }): Promise<Result<void, AppError>>;
  close(): Promise<void>;
}
