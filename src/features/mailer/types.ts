import type { AppError } from "@/constants/errorIds";
import type { Result } from "@/types/result";

export interface SystemMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Where a template's copy goes before a recipient is known.
export type MailContent = Omit<SystemMail, "to">;

export interface SystemMailer {
  readonly mode: "smtp" | "log" | "capture";
  send(mail: SystemMail, signal: AbortSignal): Promise<Result<{ messageId: string }, AppError>>;
}
