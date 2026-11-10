import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_RECIPIENT_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  SEQUENCE_ENROLLMENT_STATUSES,
  SEQUENCE_STATUSES,
  SEQUENCE_STEP_KINDS,
} from "@/constants/campaigns";
import { citext, users } from "./identity";
import { persons } from "./persons";

// Part 14: campaigns, the send snapshot, tracking events and automated sequences. The block
// document and the segment are jsonb because they are documents the editor owns; anything the
// sender or the report filters on is a real column.

// The bulk sender address. Citext keeps a case-only duplicate from becoming a second sender.
export const campaignSenders = pgTable(
  "campaign_senders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromName: text("from_name").notNull(),
    fromEmail: citext("from_email").notNull(),
    // Null is Pending: the verification token has not been confirmed yet.
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("campaign_senders_email_uq").on(t.fromEmail),
    // At most one default sender: the partial index makes a second default impossible.
    uniqueIndex("campaign_senders_default_uq").on(t.isDefault).where(sql`${t.isDefault}`),
  ],
);

// Singleton like email_design: the migration seeds the row so reads never create state.
export const campaignSettings = pgTable(
  "campaign_settings",
  {
    id: smallint("id").primaryKey().default(1),
    postalAddress: text("postal_address"),
    requireDoubleOptIn: boolean("require_double_opt_in").notNull().default(true),
    consentLabel: text("consent_label"),
    // The effective ceiling is min(this, CAMPAIGN_SEND_RATE_PER_MINUTE); settings can lower it.
    sendRatePerMinute: integer("send_rate_per_minute").notNull().default(60),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("campaign_settings_singleton_ck", sql`${t.id} = 1`),
    check("campaign_settings_rate_ck", sql`${t.sendRatePerMinute} > 0`),
  ],
);

export const campaignTemplates = pgTable("campaign_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  content: jsonb("content").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Image metadata only; the bytes live in MinIO under storage_key. The public route streams by id.
export const campaignAssets = pgTable(
  "campaign_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sha256: text("sha256").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    storageKey: text("storage_key").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_assets_sha256_uq").on(t.sha256),
    check("campaign_assets_mime_ck", sql`${t.mime} in ('image/png','image/jpeg','image/gif')`),
    check("campaign_assets_size_ck", sql`${t.size} > 0`),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull().default("newsletter"),
    status: text("status").notNull().default("draft"),
    subject: text("subject").notNull().default(""),
    preheader: text("preheader"),
    senderId: uuid("sender_id").references(() => campaignSenders.id, { onDelete: "set null" }),
    replyTo: text("reply_to"),
    // { kind: "saved_filter", savedFilterId } or { kind: "definition", definition }.
    segment: jsonb("segment"),
    content: jsonb("content"),
    templateId: uuid("template_id").references(() => campaignTemplates.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // Fixed when sending starts: the segment is evaluated as this user from then on.
    sendAsUserId: uuid("send_as_user_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    totals: jsonb("totals").notNull().default(sql`'{}'::jsonb`),
    // Persisted token bucket: the window start and how many were sent inside it.
    rateWindowStartedAt: timestamp("rate_window_started_at", { withTimezone: true }),
    rateSentCount: integer("rate_sent_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("campaigns_status_idx").on(t.status, t.scheduledAt),
    check(
      "campaigns_type_ck",
      sql`${t.type} in ('newsletter','announcement','promotion','event','nurture','other')`,
    ),
    check(
      "campaigns_status_ck",
      sql`${t.status} in ('draft','scheduled','sending','paused','sent','cancelled')`,
    ),
    check("campaigns_rate_count_ck", sql`${t.rateSentCount} >= 0`),
  ],
);

// Frozen at send start: link index to URL template, so a recipient's click never trusts a request
// URL and the same template renders for every recipient.
export const campaignLinks = pgTable(
  "campaign_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    linkIndex: integer("link_index").notNull(),
    urlTemplate: text("url_template").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_links_campaign_index_uq").on(t.campaignId, t.linkIndex),
    check("campaign_links_index_ck", sql`${t.linkIndex} >= 0`),
  ],
);

// One row per person per campaign, unique by email hash so a duplicate address is sent once.
export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    emailHash: text("email_hash").notNull(),
    status: text("status").notNull().default("queued"),
    // The one token behind the pixel, the click redirects and the unsubscribe page.
    tokenHash: text("token_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    retryAt: timestamp("retry_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_recipients_campaign_email_uq").on(t.campaignId, t.emailHash),
    index("campaign_recipients_queue_idx").on(t.campaignId, t.status),
    check(
      "campaign_recipients_status_ck",
      sql`${t.status} in ('queued','sending','sent','bounced_hard','failed_soft','skipped_status','skipped_suppressed','skipped_cancelled')`,
    ),
    check("campaign_recipients_attempts_ck", sql`${t.attempts} >= 0`),
  ],
);

export const campaignEvents = pgTable(
  "campaign_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => campaignRecipients.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    linkIndex: integer("link_index"),
    // A user-agent family only: no raw IP and no location for opens and clicks (6.8).
    userAgentFamily: text("user_agent_family"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("campaign_events_campaign_type_idx").on(t.campaignId, t.type),
    index("campaign_events_person_idx").on(t.personId, t.createdAt),
    check(
      "campaign_events_type_ck",
      sql`${t.type} in ('open','click','unsubscribe','bounce_hard','bounce_soft','complaint','delivered')`,
    ),
  ],
);

export const sequences = pgTable(
  "sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    senderId: uuid("sender_id").references(() => campaignSenders.id, { onDelete: "set null" }),
    replyTo: text("reply_to"),
    entry: jsonb("entry").notNull().default(sql`'{}'::jsonb`),
    exit: jsonb("exit").notNull().default(sql`'{}'::jsonb`),
    sendWindow: jsonb("send_window").notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("sequences_status_ck", sql`${t.status} in ('draft','active','paused')`)],
);

export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    subject: text("subject"),
    preheader: text("preheader"),
    content: jsonb("content"),
    waitMinutes: integer("wait_minutes"),
    // Each email step gets a hidden nurture campaign so tracking and reports are identical.
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sequence_steps_position_uq").on(t.sequenceId, t.position),
    check("sequence_steps_kind_ck", sql`${t.kind} in ('email','wait')`),
    check("sequence_steps_wait_ck", sql`${t.waitMinutes} is null or ${t.waitMinutes} >= 0`),
  ],
);

export const sequenceEnrollments = pgTable(
  "sequence_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    currentPosition: integer("current_position").notNull().default(0),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    exitReason: text("exit_reason"),
  },
  (t) => [
    // A person can re-enter a sequence after completing it, but never twice at once.
    uniqueIndex("sequence_enrollments_active_uq")
      .on(t.sequenceId, t.personId)
      .where(sql`${t.status} = 'active'`),
    index("sequence_enrollments_due_idx").on(t.status, t.nextRunAt),
    check(
      "sequence_enrollments_status_ck",
      sql`${t.status} in ('active','completed','exited','failed')`,
    ),
  ],
);

// Segment entry memory: a person who leaves the filter and comes back is not enrolled again
// unless the sequence allows re-entry (6.10).
export const sequenceSegmentMembers = pgTable(
  "sequence_segment_members",
  {
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sequenceId, t.personId] })],
);

export {
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_RECIPIENT_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  SEQUENCE_ENROLLMENT_STATUSES,
  SEQUENCE_STATUSES,
  SEQUENCE_STEP_KINDS,
};

export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignRecipientRow = typeof campaignRecipients.$inferSelect;
export type CampaignSenderRow = typeof campaignSenders.$inferSelect;
export type SequenceRow = typeof sequences.$inferSelect;
