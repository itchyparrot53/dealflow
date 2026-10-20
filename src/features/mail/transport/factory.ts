import { env } from "@/config/env";
import { createFakeTransportFactory } from "./fake";
import { createRealTransportFactory } from "./real";
import type { MailTransportFactory } from "./types";

// The one place that decides real vs fake. A non-empty MAIL_PROVIDER_FAKE_DIR routes every IMAP
// account to the filesystem fake, so tests and e2e never touch a network transport.
export function getMailTransportFactory(): MailTransportFactory {
  return env.MAIL_PROVIDER_FAKE_DIR === ""
    ? createRealTransportFactory()
    : createFakeTransportFactory(env.MAIL_PROVIDER_FAKE_DIR);
}

// Read from env here (not at import time) so tests can flip the fake per case.
export function mailTransportMode(): "real" | "fake" {
  return env.MAIL_PROVIDER_FAKE_DIR === "" ? "real" : "fake";
}
