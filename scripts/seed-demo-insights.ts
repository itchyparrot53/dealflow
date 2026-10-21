// Part 7 demo data: the default "Sales overview" dashboard, one private activities report for the
// admin, and a shared "Team activity" dashboard with an activities-by-type widget (plus a goal
// widget when the demo has a goal). Re-runnable: it removes only the rows it owns by name.

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "@/db/schema";
import { ensureDefaultDashboard } from "@/features/insights/defaultDashboard";
import type { ReportDefinition } from "@/features/insights/definition";

const ADMIN_REPORT = "My activities by week";
const TYPE_REPORT = "Activities by type";
const DASHBOARD = "Team activity";

const PRIVATE_DEFINITION: ReportDefinition = {
  entity: "activity",
  measure: { kind: "count" },
  groupBy: { field: "due_at", interval: "week" },
  segmentBy: null,
  dateRange: { field: "due_at", preset: "this_year" },
  filter: null,
  chart: "bar",
};

const TYPE_DEFINITION: ReportDefinition = {
  entity: "activity",
  measure: { kind: "count" },
  groupBy: { field: "activity_type" },
  segmentBy: null,
  dateRange: { field: "due_at", preset: "this_month" },
  filter: null,
  chart: "pie",
};

export interface SeedInsightsCounts {
  reports: number;
  dashboards: number;
  widgets: number;
}

export async function seedInsights(args: {
  ownerId: string;
  pool: Pool;
}): Promise<SeedInsightsCounts> {
  const signal = AbortSignal.timeout(30_000);
  const db = drizzle(args.pool, { schema });

  await ensureDefaultDashboard(db, signal);

  // Remove the previous run's rows first so re-seeding never duplicates.
  await db
    .delete(schema.dashboards)
    .where(and(eq(schema.dashboards.name, DASHBOARD), eq(schema.dashboards.ownerId, args.ownerId)));
  await db
    .delete(schema.reports)
    .where(
      and(
        eq(schema.reports.ownerId, args.ownerId),
        inArray(schema.reports.name, [ADMIN_REPORT, TYPE_REPORT]),
      ),
    );

  const [privateReport] = await db
    .insert(schema.reports)
    .values({
      name: ADMIN_REPORT,
      description: "How many activities are due each ISO week this year.",
      definition: PRIVATE_DEFINITION,
      shared: false,
      ownerId: args.ownerId,
    })
    .returning({ id: schema.reports.id });
  const [typeReport] = await db
    .insert(schema.reports)
    .values({
      name: TYPE_REPORT,
      description: "Activities due this month, split by type.",
      definition: TYPE_DEFINITION,
      shared: true,
      ownerId: args.ownerId,
    })
    .returning({ id: schema.reports.id });
  if (privateReport === undefined || typeReport === undefined) {
    throw new Error("seedInsights: report insert returned no rows");
  }

  const [dashboard] = await db
    .insert(schema.dashboards)
    .values({ name: DASHBOARD, shared: true, ownerId: args.ownerId })
    .returning({ id: schema.dashboards.id });
  if (dashboard === undefined) {
    throw new Error("seedInsights: dashboard insert returned no rows");
  }

  const [goal] = await db
    .select({ id: schema.goals.id })
    .from(schema.goals)
    .where(isNull(schema.goals.deletedAt))
    .orderBy(asc(schema.goals.createdAt))
    .limit(1);

  const widgets: Array<typeof schema.dashboardWidgets.$inferInsert> = [
    {
      dashboardId: dashboard.id,
      position: 0,
      kind: "report",
      reportId: typeReport.id,
      size: "half",
    },
  ];
  if (goal !== undefined) {
    widgets.push({
      dashboardId: dashboard.id,
      position: 1,
      kind: "goal",
      goalId: goal.id,
      size: "half",
    });
  }
  await db.insert(schema.dashboardWidgets).values(widgets);

  return { reports: 2, dashboards: 1, widgets: widgets.length };
}
