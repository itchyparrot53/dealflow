import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { captureMailer } from "@/features/mailer/captureMailer";
import { getSystemMailer } from "@/features/mailer/systemMailer";
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

function marketingTransport() {
  const dkim = dkimConfig();
  return nodemailer.createTransport({
    host: env.MARKETING_SMTP_HOST,
    port: env.MARKETING_SMTP_PORT,
    secure: env.MARKETING_SMTP_SECURE,
    auth:
      env.MARKETING_SMTP_USER === ""
        ? undefined
        : { user: env.MARKETING_SMTP_USER, pass: env.MARKETING_SMTP_PASS },
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
  if (env.MARKETING_SMTP_HOST === "") {
    const result = await getSystemMailer().send(mail, signal);
    return result.ok ? ok(result.value) : err({ failure: "soft", detail: result.error.id });
  }

  signal.throwIfAborted();
  try {
    const info = await marketingTransport().sendMail({
      from: mail.from ?? env.SMTP_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
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
