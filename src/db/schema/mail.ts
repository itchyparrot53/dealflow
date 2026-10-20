import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { SpecialUse } from "@/constants/mail";
import { emailAccounts, emailMessages, emailSendAttempts } from "./email";

// bytea for the encrypted mailbox password; same shape the email schema uses for OAuth tokens.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// IMAP/SMTP credentials for a mailbox. The presence of a row is what makes an account "imap";
// the password is encrypted with encryptToken() and only ever decrypted inside a function call.
export const mailAccountCredentials = pgTable("mail_account_credentials", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => emailAccounts.id, { onDelete: "cascade" }),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull(),
  imapSecure: boolean("imap_secure").notNull().default(true),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  username: text("username").notNull(),
  passwordEnc: bytea("password_enc").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// One cursor per synced folder. uid_validity is the folder's generation: a change resets the
// folder. highest_modseq null means unknown (Purelymail reports 0 for an empty folder).
export const mailFolderCursors = pgTable(
  "mail_folder_cursors",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => emailAccounts.id, { onDelete: "cascade" }),
    folder: text("folder").notNull(),
    specialUse: text("special_use").$type<SpecialUse>(),
    uidValidity: bigint("uid_validity", { mode: "bigint" }).notNull(),
    lastUid: bigint("last_uid", { mode: "number" }).notNull().default(0),
    uidNext: bigint("uid_next", { mode: "number" }).notNull().default(0),
    highestModseq: bigint("highest_modseq", { mode: "bigint" }),
    backfillBefore: timestamp("backfill_before", { withTimezone: true }),
    backfillDone: boolean("backfill_done").notNull().default(false),
    lastListedAt: timestamp("last_listed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.folder] })],
);

// Where a message physically lives. One message row can have several locations (INBOX and Sent,
// for example); this is also the folder/UID lookup for attachments and trash.
export const mailMessageLocations = pgTable(
  "mail_message_locations",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => emailAccounts.id, { onDelete: "cascade" }),
    folder: text("folder").notNull(),
    uidValidity: bigint("uid_validity", { mode: "bigint" }).notNull(),
    uid: bigint("uid", { mode: "number" }).notNull(),
    providerMessageId: text("provider_message_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.folder, t.uidValidity, t.uid] }),
    index("mml_account_msg_idx").on(t.accountId, t.providerMessageId),
  ],
);

// RFC 822 threading headers per stored message. IMAP writes it for inbound and outbound; the
// thread-key resolver and reply headers read it.
export const emailMessageHeaders = pgTable(
  "email_message_headers",
  {
    messageId: uuid("message_id")
      .primaryKey()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull(),
    rfc822MessageId: text("rfc822_message_id").notNull(),
    inReplyTo: text("in_reply_to"),
    references: text("references")
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [index("emh_account_rfc_idx").on(t.accountId, t.rfc822MessageId)],
);

// Sent copies still waiting for APPEND to the mailbox's Sent folder. Purelymail does not save
// sent mail itself, so a send writes this row and retries until the copy lands.
export const mailSentAppends = pgTable("mail_sent_appends", {
  attemptId: uuid("attempt_id")
    .primaryKey()
    .references(() => emailSendAttempts.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull(),
  status: text("status").notNull().$type<"pending" | "done" | "gave_up">().default("pending"),
  tries: integer("tries").notNull().default(0),
  lastErrorId: text("last_error_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
