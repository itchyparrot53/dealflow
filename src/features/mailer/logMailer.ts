import { randomUUID } from "node:crypto";
import { ok } from "@/types/result";
import type { SystemMailer } from "./types";

// Log mode: the local default when SMTP_HOST is empty. Sign-in links are printed so a developer can
// follow them; nothing leaves the machine. The body is included because the link is the whole point.
export function logMailer(): SystemMailer {
  return {
    mode: "log",
    send(mail, signal) {
      signal.throwIfAborted();
      console.warn(`[mailer:log] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
      return Promise.resolve(ok({ messageId: randomUUID() }));
    },
  };
}
