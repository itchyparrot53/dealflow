import { env } from "@/config/env";
import { createRealTransportFactory } from "./real";
import type { MailTransportFactory } from "./types";

// The one place that decides real vs fake. The fake arrives in Task 2.3; until then an empty
// MAIL_PROVIDER_FAKE_DIR means the real imapflow/nodemailer transports.
export function getMailTransportFactory(): MailTransportFactory {
  return createRealTransportFactory();
}

// Read from env here (not at import time) so tests can flip the fake per case.
export function mailTransportMode(): "real" | "fake" {
  return env.MAIL_PROVIDER_FAKE_DIR === "" ? "real" : "fake";
}
