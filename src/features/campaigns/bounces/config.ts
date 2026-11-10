import { env } from "@/config/env";
import type { ImapCredentials } from "@/features/mail/transport/types";

// 6.8: the bounce mailbox is opt-in. All three identity values must exist; the port keeps its 993
// default, and 993 means implicit TLS. A partly set mailbox is treated as not configured so a
// worker boot never fails on an unfinished deploy.

export function bounceMailboxConfigured(): boolean {
  return (
    env.CAMPAIGN_BOUNCE_IMAP_HOST !== "" &&
    env.CAMPAIGN_BOUNCE_IMAP_USER !== "" &&
    env.CAMPAIGN_BOUNCE_IMAP_PASS !== ""
  );
}

export function bounceMailboxCredentials(): ImapCredentials | null {
  if (!bounceMailboxConfigured()) return null;
  return {
    host: env.CAMPAIGN_BOUNCE_IMAP_HOST,
    port: env.CAMPAIGN_BOUNCE_IMAP_PORT,
    secure: env.CAMPAIGN_BOUNCE_IMAP_PORT === 993,
    username: env.CAMPAIGN_BOUNCE_IMAP_USER,
    password: env.CAMPAIGN_BOUNCE_IMAP_PASS,
  };
}
