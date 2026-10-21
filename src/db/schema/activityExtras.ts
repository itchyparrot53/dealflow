import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { activities } from "./activities";
import { users } from "./identity";

// Part 9 activity side tables (6.4). They are keyed by activity so the activities table is
// untouched: recurrence rules, call metadata and duplicate dismissals live beside it.

// One row per activity that belongs to a recurring series. The rule is the Zod-validated
// RecurrenceRule, stored as JSONB because the app validates it at the boundary and the DB only
// needs to keep the shape. anchor_day is the series' original local day of month, used to clamp
// monthly and yearly occurrences; ended stops future occurrences without touching past ones.
export const activityRecurrence = pgTable(
  "activity_recurrence",
  {
    activityId: uuid("activity_id")
      .primaryKey()
      .references(() => activities.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").notNull(),
    rule: jsonb("rule").notNull(),
    anchorDay: integer("anchor_day").notNull(),
    occurrence: integer("occurrence").notNull().default(1),
    ended: boolean("ended").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_recurrence_series_idx").on(t.seriesId),
    check("activity_recurrence_anchor_day_ck", sql`${t.anchorDay} between 1 and 31`),
    check("activity_recurrence_occurrence_ck", sql`${t.occurrence} >= 1`),
  ],
);

// Call logging stores the outcome vocabulary and the call's direction beside the activity. The
// activity itself is a normal done activity, so the timeline, permissions and search code paths
// need no special case; only the chip renderer reads this row.
export const activityCalls = pgTable(
  "activity_calls",
  {
    activityId: uuid("activity_id")
      .primaryKey()
      .references(() => activities.id, { onDelete: "cascade" }),
    outcome: text("outcome").notNull(),
    direction: text("direction").notNull(),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "activity_calls_outcome_ck",
      sql`${t.outcome} in ('connected','no_answer','left_voicemail','busy','wrong_number')`,
    ),
    check("activity_calls_direction_ck", sql`${t.direction} in ('outbound','inbound')`),
    check(
      "activity_calls_duration_ck",
      sql`${t.durationSeconds} is null or (${t.durationSeconds} between 0 and 86400)`,
    ),
  ],
);

// A dismissed duplicate pair is remembered for good. Ids are stored in sorted order (a_id < b_id)
// so the same pair always lands on one row regardless of which side the finder saw first; the
// unique triple is what makes "Not duplicates" idempotent.
export const duplicateDismissals = pgTable(
  "duplicate_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entity: text("entity").notNull(),
    aId: uuid("a_id").notNull(),
    bId: uuid("b_id").notNull(),
    dismissedBy: uuid("dismissed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("duplicate_dismissals_entity_ck", sql`${t.entity} in ('person','organization')`),
    check("duplicate_dismissals_order_ck", sql`${t.aId} < ${t.bId}`),
    unique("duplicate_dismissals_pair_uq").on(t.entity, t.aId, t.bId),
  ],
);
