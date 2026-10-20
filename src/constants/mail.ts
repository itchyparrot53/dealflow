// IMAP/SMTP mail: folder roles, provider presets and the limits shared by the sync engine,
// the sender and the settings UI. Numbers live here so the transport, jobs and UI cannot drift.

export type SpecialUse = "inbox" | "sent" | "archive" | "junk" | "trash" | "drafts";

// Folders the CRM mirrors. Drafts are deliberately ignored (no draft sync in this part).
export const MAIL_FOLDER_SYNC_USES = ["inbox", "sent", "archive", "junk", "trash"] as const;

export interface MailPreset {
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export const MAIL_PRESETS = {
  purelymail: {
    label: "Purelymail",
    imapHost: "imap.purelymail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.purelymail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
} as const satisfies Record<string, MailPreset>;

// How many messages one FETCH batch asks for, and the cap per backfill job run.
export const MAIL_BATCH_SIZE = 25;
// Older mail is backfilled in windows of this size, up to MAIL_BACKFILL_DAYS.
export const MAIL_BACKFILL_WINDOW_DAYS = 90;
export const MAIL_BACKFILL_MAX_PER_RUN = 300;
// A Sent APPEND is retried hourly-ish until it lands; after this many tries it gives up.
export const MAIL_APPEND_MAX_TRIES = 12;
// A folder is relisted at most this often when HIGHESTMODSEQ says nothing changed.
export const MAIL_RELIST_MINUTES = 15;
// Subject-plus-participant threading only looks this far back.
export const MAIL_THREAD_FALLBACK_DAYS = 30;
// Interactive send budget for IMAP accounts (SMTP plus the inline Sent APPEND).
export const MAIL_SEND_TIMEOUT_MS = 30_000;
// The Sent APPEND after a successful SMTP send has its own budget so a slow APPEND can never
// abort a send that the server already accepted.
export const MAIL_APPEND_TIMEOUT_MS = 15_000;
