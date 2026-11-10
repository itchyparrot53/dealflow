import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { persons } from "./persons";

// Part 14: consent and suppression. The status lives beside the person, never on the person row,
// so a person delete removes the marketing record but leaves the suppression keyed by email hash:
// the same address must stay suppressed if it is imported again as a new person.

export const MARKETING_STATUSES = [
  "not_subscribed",
  "pending",
  "subscribed",
  "unsubscribed",
  "bounced",
] as const;

export const marketingStatusEnum = pgEnum("marketing_status", MARKETING_STATUSES);

export const CONSENT_SOURCES = [
  "manual",
  "bulk",
  "import",
  "form",
  "double_opt_in",
  "unsubscribe_link",
  "one_click",
  "preference_page",
  "bounce",
  "complaint",
  "system",
] as const;

export const CONSENT_BASES = [
  "double_opt_in",
  "form_consent",
  "explicit",
  "legitimate_interest",
  "imported",
] as const;

export const SUPPRESSION_REASONS = ["unsubscribed", "hard_bounce", "complaint"] as const;

export const MARKETING_TOKEN_PURPOSES = ["doi", "unsub", "sender"] as const;

// A missing row means not_subscribed (6.2), so rows are only written on the first change.
export const personMarketing = pgTable(
  "person_marketing",
  {
    personId: uuid("person_id")
      .primaryKey()
      .references(() => persons.id, { onDelete: "cascade" }),
    status: marketingStatusEnum("status").notNull().default("not_subscribed"),
    // Evidence of how the current status was reached; nullable because not_subscribed has none.
    consentBasis: text("consent_basis"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    softBounceCount: integer("soft_bounce_count").notNull().default(0),
  },
  (t) => [
    check(
      "person_marketing_basis_ck",
      sql`${t.consentBasis} is null or ${t.consentBasis} in ('double_opt_in','form_consent','explicit','legitimate_interest','imported')`,
    ),
    check("person_marketing_soft_bounce_ck", sql`${t.softBounceCount} >= 0`),
  ],
);

// Append-only evidence. person_id is SET NULL on purpose: the consent trail outlives the contact,
// matched by email_hash, which is the same key the suppression list uses.
export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    emailHash: text("email_hash").notNull(),
    fromStatus: marketingStatusEnum("from_status"),
    toStatus: marketingStatusEnum("to_status").notNull(),
    source: text("source").notNull(),
    basis: text("basis"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    // Only written for double_opt_in, unsubscribe_link, one_click and preference_page (6.2).
    ip: text("ip"),
    userAgent: text("user_agent"),
    campaignId: uuid("campaign_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consent_events_person_idx").on(t.personId, t.createdAt.desc()),
    index("consent_events_email_hash_idx").on(t.emailHash),
    check(
      "consent_events_source_ck",
      sql`${t.source} in ('manual','bulk','import','form','double_opt_in','unsubscribe_link','one_click','preference_page','bounce','complaint','system')`,
    ),
    check(
      "consent_events_basis_ck",
      sql`${t.basis} is null or ${t.basis} in ('double_opt_in','form_consent','explicit','legitimate_interest','imported')`,
    ),
  ],
);

// Keyed by email hash so it survives person deletion and blocks a later person with the same email.
export const marketingSuppressions = pgTable(
  "marketing_suppressions",
  {
    emailHash: text("email_hash").primaryKey(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "marketing_suppressions_reason_ck",
      sql`${t.reason} in ('unsubscribed','hard_bounce','complaint')`,
    ),
  ],
);

// Only the SHA-256 hex is stored, so a leaked database cannot be turned into working links.
// sender_id has no FK: sender verification tokens outlive a deleted sender harmlessly, and the
// lookup rejects a missing sender anyway.
export const marketingTokens = pgTable(
  "marketing_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    purpose: text("purpose").notNull(),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "cascade" }),
    campaignRecipientId: uuid("campaign_recipient_id"),
    senderId: uuid("sender_id"),
    // Null means no expiry (unsubscribe tokens); double opt-in is 30 days, sender 48 hours.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("marketing_tokens_person_idx").on(t.personId, t.purpose),
    index("marketing_tokens_sender_idx").on(t.senderId),
    check("marketing_tokens_purpose_ck", sql`${t.purpose} in ('doi','unsub','sender')`),
  ],
);

export type PersonMarketingRow = typeof personMarketing.$inferSelect;
export type ConsentEventRow = typeof consentEvents.$inferSelect;
export type MarketingTokenRow = typeof marketingTokens.$inferSelect;
