import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { captureMailer } from "@/features/mailer/captureMailer";
import type { SystemMail } from "@/features/mailer/types";
import { err, ok, type Result } from "@/types/result";

// 6.7's transport. MARKETING_SMTP_* is used when set so bulk mail never damages a personal
// mailbox's reputation; otherwise the system transport is used. MAIL_FAKE always captures.

export type SendFailure = "hard" | "soft";

export interface SendOutcome {
  messageId: string;
}

export interface DkimConfig {
  domain: string;
  selector: string;
  privateKey: string;
}

// Signing only when all three values exist. The key can come from an env value or a file path.
export function dkimConfig(): DkimConfig | null {
  if (env.CAMPAIGN_DKIM_DOMAIN === "" || env.CAMPAIGN_DKIM_SELECTOR === "") return null;
  const fromFile =
    env.CAMPAIGN_DKIM_PRIVATE_KEY_FILE === ""
      ? ""
      : readFileSync(env.CAMPAIGN_DKIM_PRIVATE_KEY_FILE, "utf8");
  const privateKey =
    env.CAMPAIGN_DKIM_PRIVATE_KEY !== "" ? env.CAMPAIGN_DKIM_PRIVATE_KEY : fromFile;
  if (privateKey === "") return null;
  return { domain: env.CAMPAIGN_DKIM_DOMAIN, selector: env.CAMPAIGN_DKIM_SELECTOR, privateKey };
}

function responseCode(error: unknown): number | null {
  const value = (error as { responseCode?: unknown } | null)?.responseCode;
  return typeof value === "number" ? value : null;
}

function classify(error: unknown): SendFailure {
  const code = responseCode(error);
  return code !== null && code >= 500 ? "hard" : "soft";
}

function campaignTransport() {
  const dkim = dkimConfig();
  const usingMarketing = env.MARKETING_SMTP_HOST !== "";
  const host = usingMarketing ? env.MARKETING_SMTP_HOST : env.SMTP_HOST;
  if (host === "") return null;
  return nodemailer.createTransport({
    host,
    port: usingMarketing ? env.MARKETING_SMTP_PORT : env.SMTP_PORT,
    secure: usingMarketing ? env.MARKETING_SMTP_SECURE : env.SMTP_SECURE,
    auth:
      (usingMarketing ? env.MARKETING_SMTP_USER : env.SMTP_USER) === ""
        ? undefined
        : {
            user: usingMarketing ? env.MARKETING_SMTP_USER : env.SMTP_USER,
            pass: usingMarketing ? env.MARKETING_SMTP_PASS : env.SMTP_PASS,
          },
    ...(dkim === null ? {} : { dkim }),
  });
}

// Sends one campaign message and classifies a failure for the retry path: a 5xx is a hard bounce,
// a 4xx or network error is soft and retried.
export async function sendCampaignMail(
  mail: SystemMail,
  signal: AbortSignal,
): Promise<Result<SendOutcome, { failure: SendFailure; detail: string }>> {
  if (env.MAIL_FAKE) {
    const result = await captureMailer().send(mail, signal);
    return result.ok ? ok(result.value) : err({ failure: "soft", detail: result.error.id });
  }
  const transport = campaignTransport();
  if (transport === null) {
    // Never fall through to the log mailer: its body would contain merge values and a live
    // unsubscribe token. A failed send is a value and goes through the soft retry path.
    return err({ failure: "soft", detail: "no SMTP host" });
  }

  signal.throwIfAborted();
  try {
    const info = await transport.sendMail({
      from: mail.from ?? env.SMTP_FROM,
      replyTo: mail.replyTo,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
      attachments: mail.attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content,
      })),
    });
    signal.throwIfAborted();
    return ok({ messageId: info.messageId });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return err({
      failure: classify(error),
      detail: `status ${responseCode(error) ?? "network"}`,
    });
  }
}

// Exposed so the DKIM unit test can assert the three-value gate without a real SMTP server.
export function campaignTransportKind(): "capture" | "marketing" | "system" {
  if (env.MAIL_FAKE) return "capture";
  return env.MARKETING_SMTP_HOST === "" ? "system" : "marketing";
}

// Kept for symmetry with the app's AppError rule: a failed send is a value, never a throw.
export function sendFailureError(detail: string): AppError {
  return new AppError(ERROR_IDS.MAIL_SEND_FAILED, "campaign send failed", { detail });
}
