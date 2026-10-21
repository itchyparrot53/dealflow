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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { goals } from "./goals";
import { users } from "./identity";

// Part 7 Insights. A report is a saved definition; a dashboard arranges reports and goals into
// widgets. Definitions stay untyped jsonb here (the same reason as automations and web forms):
// the feature schema owns the shape, and importing it into src/db/schema would invert the
// dependency direction.

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    definition: jsonb("definition").notNull(),
    shared: boolean("shared").notNull().default(false),
    // A report cannot outlive the person who owns it.
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_owner_idx").on(t.ownerId),
    // Shared reports are the minority, so the list query needs a small partial index.
    index("reports_shared_idx").on(t.shared).where(sql`${t.shared}`),
    check("reports_name_ck", sql`char_length(${t.name}) between 1 and 120`),
    check("reports_description_ck", sql`char_length(${t.description}) <= 500`),
  ],
);

export const dashboards = pgTable(
  "dashboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    shared: boolean("shared").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // At most one default dashboard, enforced by the database so two first visits cannot race
    // into two defaults.
    uniqueIndex("dashboards_default_uq").on(t.isDefault).where(sql`${t.isDefault}`),
    check("dashboards_name_ck", sql`char_length(${t.name}) between 1 and 120`),
  ],
);

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "cascade" }),
    size: text("size").notNull().default("half"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dashboard_widgets_dashboard_idx").on(t.dashboardId, t.position),
    check("dashboard_widgets_kind_ck", sql`${t.kind} in ('report', 'goal')`),
    check("dashboard_widgets_size_ck", sql`${t.size} in ('half', 'full')`),
    check(
      "dashboard_widgets_target_ck",
      sql`(${t.kind} = 'report' and ${t.reportId} is not null and ${t.goalId} is null) or (${t.kind} = 'goal' and ${t.goalId} is not null and ${t.reportId} is null)`,
    ),
  ],
);
