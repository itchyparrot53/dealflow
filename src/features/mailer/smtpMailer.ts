import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok } from "@/types/result";
import type { SystemMailer } from "./types";

// SMTP mode for a real host. A failed send is a value, not a throw: sign-in routes must be able to
// tell the user to try again instead of crashing the request handler.
export function smtpMailer(): SystemMailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER === "" ? undefined : { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return {
    mode: "smtp",
    async send(mail, signal) {
      signal.throwIfAborted();
      try {
        const info = await transport.sendMail({
          from: env.SMTP_FROM,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        signal.throwIfAborted();
        return ok({ messageId: info.messageId });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        // Deliberately no context beyond the recipient: transport options carry the password.
        return err(
          new AppError(ERROR_IDS.MAIL_SEND_FAILED, "system mail send failed", { to: mail.to }),
        );
      }
    },
  };
}
