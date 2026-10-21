import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { notificationType } from "./notifications";

// One row per browser/device subscription. The endpoint is unique because a browser profile has
// exactly one push subscription per service worker: re-subscribing (or signing in as another user
// on a shared machine) moves the existing endpoint to the new owner instead of duplicating it.
// `failures` counts consecutive delivery failures so a dead endpoint is eventually removed
// (PUSH_MAX_FAILURES); `last_success_at` is the last time a send was accepted.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: varchar("user_agent", { length: 300 }),
    failures: integer("failures").notNull().default(0),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

// Per-user, per-type push opt-in. A missing row means "use the default" (see push/prefs.ts), so
// an absent row can never disagree with the shipped defaults the way a stored copy would.
export const notificationPushPrefs = pgTable(
  "notification_push_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    enabled: boolean("enabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NotificationPushPref = typeof notificationPushPrefs.$inferSelect;
