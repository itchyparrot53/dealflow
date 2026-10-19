import { env } from "@/config/env";
import { captureMailer } from "./captureMailer";
import { logMailer } from "./logMailer";
import { smtpMailer } from "./smtpMailer";
import type { SystemMailer } from "./types";

const CACHE_KEY = Symbol.for("dealflow.systemMailer");

function cache(): Record<symbol, SystemMailer | undefined> {
  return globalThis;
}

function build(): SystemMailer {
  if (env.MAIL_FAKE) {
    // One warning per process: capture mode is deliberate in tests and the e2e stack, and a
    // production deploy that turns it on should be reminded that nothing is actually delivered.
    console.warn("MAIL_FAKE is on: system mail is captured to disk, not sent");
    return captureMailer();
  }
  // No SMTP host means no mail server: print the links to the log instead of failing sign-in.
  if (env.SMTP_HOST === "") {
    console.warn("SMTP_HOST is empty: system mail is written to the server log");
    return logMailer();
  }
  return smtpMailer();
}

export function getSystemMailer(): SystemMailer {
  const store = cache();
  const existing = store[CACHE_KEY];
  if (existing !== undefined) return existing;
  const created = build();
  store[CACHE_KEY] = created;
  return created;
}

export function setSystemMailerForTest(mailer: SystemMailer | null): void {
  const store = cache();
  if (mailer === null) delete store[CACHE_KEY];
  else store[CACHE_KEY] = mailer;
}
