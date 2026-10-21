import { and, asc, eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { dashboards, dashboardWidgets, pipelines, reports, users } from "@/db/schema";
import { err, ok, type Result } from "@/types/result";
import type { ReportDefinition } from "./definition";

// The first Insights visit creates one shared "Sales overview" dashboard with six reports. A
// transaction-scoped advisory lock makes that idempotent: two concurrent first visits (a page
// prefetch racing the page itself) cannot both create reports, and the partial unique index on
// is_default is the backstop. The reports are shared, so every user sees the same starting point.

const DEFAULT_NAME = "Sales overview";

interface DefaultReport {
  name: string;
  definition: ReportDefinition;
}

function statusCondition(status: "open" | "won" | "lost") {
  return { field: "status" as const, op: "eq" as const, value: status };
}

function defaultReports(funnelPipelineId: string | undefined): DefaultReport[] {
  const list: DefaultReport[] = [
    {
      name: "Won value by month",
      definition: {
        entity: "deal",
        measure: { kind: "sum_value" },
        groupBy: { field: "won_at", interval: "month" },
        segmentBy: null,
        dateRange: { field: "won_at", preset: "last_12_months" },
        filter: null,
        chart: "bar",
      },
    },
    {
      name: "Open pipeline by stage",
      definition: {
        entity: "deal",
        measure: { kind: "weighted_value" },
        groupBy: { field: "stage" },
        segmentBy: null,
        dateRange: { field: "created_at", preset: "all_time" },
        filter: { combinator: "and", conditions: [statusCondition("open")] },
        chart: "bar",
      },
    },
    {
      name: "Deals won vs lost by month",
      definition: {
        entity: "deal",
        measure: { kind: "count" },
        groupBy: { field: "created_at", interval: "month" },
        segmentBy: { field: "status" },
        dateRange: { field: "created_at", preset: "last_12_months" },
        filter: { combinator: "or", conditions: [statusCondition("won"), statusCondition("lost")] },
        chart: "stacked_bar",
      },
    },
    {
      name: "Activities by type this month",
      definition: {
        entity: "activity",
        measure: { kind: "count" },
        groupBy: { field: "activity_type" },
        segmentBy: null,
        dateRange: { field: "due_at", preset: "this_month" },
        filter: null,
        chart: "pie",
      },
    },
    {
      name: "Won value this quarter",
      definition: {
        entity: "deal",
        measure: { kind: "sum_value" },
        groupBy: null,
        segmentBy: null,
        dateRange: { field: "won_at", preset: "this_quarter" },
        filter: null,
        chart: "kpi",
      },
    },
  ];

  if (funnelPipelineId !== undefined) {
    list.splice(4, 0, {
      name: "Win/loss funnel",
      definition: {
        entity: "deal",
        measure: { kind: "count" },
        groupBy: null,
        segmentBy: null,
        dateRange: { field: "created_at", preset: "this_year" },
        filter: null,
        chart: "funnel",
        funnelPipelineId,
      },
    });
  }
  return list;
}

export async function ensureDefaultDashboard(
  db: Db,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('dealflow:insights:default-dashboard'))`,
    );
    const [existing] = await tx
      .select({ id: dashboards.id })
      .from(dashboards)
      .where(eq(dashboards.isDefault, true))
      .limit(1);
    if (existing !== undefined) return ok({ id: existing.id });

    const [admin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.isActive, true)))
      .orderBy(asc(users.createdAt))
      .limit(1);
    if (admin === undefined) {
      return err(
        new AppError(ERROR_IDS.INSIGHT_NOT_FOUND, "no active admin to own the default dashboard"),
      );
    }

    const [pipeline] = await tx
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.isArchived, false))
      .orderBy(asc(pipelines.order))
      .limit(1);

    const reportRows = await tx
      .insert(reports)
      .values(
        defaultReports(pipeline?.id).map((report) => ({
          name: report.name,
          description: null,
          definition: report.definition,
          shared: true,
          ownerId: admin.id,
        })),
      )
      .returning({ id: reports.id });

    const [dashboard] = await tx
      .insert(dashboards)
      .values({ name: DEFAULT_NAME, shared: true, isDefault: true, ownerId: admin.id })
      .returning({ id: dashboards.id });
    if (dashboard === undefined) {
      return err(
        new AppError(ERROR_IDS.DB_INSERT_FAILED, "default dashboard insert returned none"),
      );
    }

    await tx.insert(dashboardWidgets).values(
      reportRows.map((report, index) => ({
        dashboardId: dashboard.id,
        position: index,
        kind: "report",
        reportId: report.id,
        size: index === 0 ? ("full" as const) : ("half" as const),
      })),
    );
    signal.throwIfAborted();
    return ok({ id: dashboard.id });
  });
}
