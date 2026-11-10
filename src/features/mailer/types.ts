import type { AppError } from "@/constants/errorIds";
import type { Result } from "@/types/result";

export interface SystemAttachment {
  filename: string;
  contentType: string;
  content: Buffer | string;
}

export interface SystemMail {
  to: string;
  // Campaign mail carries its own verified From; system mail uses SMTP_FROM.
  from?: string;
  // Campaign mail may set a different Reply-To; system mail leaves it unset.
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  // Extra RFC 5322 headers (for example List-Unsubscribe on notification mail).
  headers?: Record<string, string>;
  // Attachments (the booking .ics). The SMTP mailer passes them through; the log mailer drops them.
  attachments?: SystemAttachment[];
}

// Where a template's copy goes before a recipient is known.
export type MailContent = Omit<SystemMail, "to">;

export interface SystemMailer {
  readonly mode: "smtp" | "log" | "capture";
  send(mail: SystemMail, signal: AbortSignal): Promise<Result<{ messageId: string }, AppError>>;
}
