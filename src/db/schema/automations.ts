import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

// Part 5 automations and webhooks. The event outbox, the automation definitions and
// their run log, and the webhook subscriptions and deliveries. Kept in side tables so
// upstream tables change as little as possible.

// Encrypted webhook signing secrets (AES-256-GCM packed by src/features/email/crypto.ts).
// Never plaintext, never logged, never returned after creation.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// The outbox. A row is written inside the mutation's own transaction, so a rolled-back
// change leaves no event. `txid` is Postgres's, not ours: it is what lets the dispatcher
// coalesce several edits from one transaction into one event.
export const domainEvents = pgTable(
  "domain_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    changes: jsonb("changes"),
    txid: bigint("txid", { mode: "number" })
      .notNull()
      .default(sql`txid_current()`),
    chainId: uuid("chain_id").notNull(),
    depth: integer("depth").notNull().default(0),
    // No FK: an automation may be deleted while its events are still queued.
    automationId: uuid("automation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    // The dispatcher's only scan: the oldest unprocessed rows.
    index("domain_events_pending_idx")
      .on(t.id)
      .where(sql`${t.processedAt} is null`),
    index("domain_events_created_at_idx").on(t.createdAt),
  ],
);

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(false),
    definition: jsonb("definition").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    runCount: integer("run_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("automations_name_ck", sql`char_length(${t.name}) between 1 and 120`)],
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    // No FK: events expire on retention while runs live longer.
    eventId: bigint("event_id", { mode: "number" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    chainId: uuid("chain_id").notNull(),
    depth: integer("depth").notNull(),
    status: text("status").notNull(),
    skipReason: text("skip_reason"),
    steps: jsonb("steps").notNull().default(sql`'[]'::jsonb`),
    errorId: text("error_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    // The loop guard: one run per automation, chain and record. The dispatcher inserts
    // with ON CONFLICT DO NOTHING and treats a conflict as "already handled".
    uniqueIndex("automation_runs_guard_uq").on(t.automationId, t.chainId, t.entityId),
    index("automation_runs_automation_started_idx").on(t.automationId, t.startedAt.desc()),
    check(
      "automation_runs_status_ck",
      sql`${t.status} in ('running', 'succeeded', 'failed', 'skipped')`,
    ),
    check(
      "automation_runs_skip_reason_ck",
      sql`${t.skipReason} is null or ${t.skipReason} in ('condition_false', 'depth_limit', 'owner_inactive', 'disabled')`,
    ),
  ],
);

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  secretEnc: bytea("secret_enc").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  disabledReason: text("disabled_reason"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
    // No FK: events expire on retention while deliveries live longer.
    eventId: bigint("event_id", { mode: "number" }),
    // The delivery keeps the event type even if the event row is gone, so the log and a
    // redelivery still show what was sent.
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("webhook_deliveries_subscription_created_idx").on(t.subscriptionId, t.createdAt.desc()),
    index("webhook_deliveries_status_next_attempt_idx").on(t.status, t.nextAttemptAt),
    check(
      "webhook_deliveries_status_ck",
      sql`${t.status} in ('pending', 'succeeded', 'retrying', 'failed')`,
    ),
    check("webhook_deliveries_last_error_ck", sql`char_length(${t.lastError}) <= 500`),
  ],
);

export type DomainEventRow = typeof domainEvents.$inferSelect;
export type NewDomainEvent = typeof domainEvents.$inferInsert;
export type AutomationRow = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;
export type AutomationRunRow = typeof automationRuns.$inferSelect;
export type NewAutomationRun = typeof automationRuns.$inferInsert;
export type WebhookSubscriptionRow = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
