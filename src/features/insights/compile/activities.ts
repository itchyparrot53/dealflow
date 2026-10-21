import { sql } from "drizzle-orm";
import type { PermSetUser } from "@/features/permissions/effective";
import { buildUuidArray } from "@/features/permissions/sql";
import { activityVisibilityPredicate } from "@/features/stats/activityVisibilitySql";
import type { ActivityReportDefinition, Interval } from "../definition";
import { type CompileOptions, dateRangeClause, timestampGroupExpr } from "./shared";

// One grouped query per activity report. Activities carry no money, so the currency column is a
// constant and the engine never needs a rate; durations are summed as minutes.

function activityGroupExpr(
  field: string,
  interval: Interval | undefined,
  tz: string,
): ReturnType<typeof sql> {
  switch (field) {
    case "activity_type":
      return sql`a.type_id::text`;
    case "owner":
      return sql`a.owner_id::text`;
    case "assignee":
      return sql`a.assignee_id::text`;
    case "done":
      return sql`case when a.done then 'done' else 'open' end`;
    case "due_at":
      return timestampGroupExpr(sql`a.due_at`, interval ?? "week", tz);
    case "created_at":
      return timestampGroupExpr(sql`a.created_at`, interval ?? "week", tz);
    case "done_at":
      return timestampGroupExpr(sql`a.done_at`, interval ?? "week", tz);
    default:
      return sql`''`;
  }
}

function activitySegmentExpr(field: string): ReturnType<typeof sql> {
  switch (field) {
    case "activity_type":
      return sql`a.type_id::text`;
    case "owner":
      return sql`a.owner_id::text`;
    case "assignee":
      return sql`a.assignee_id::text`;
    case "done":
      return sql`case when a.done then 'done' else 'open' end`;
    default:
      return sql`''`;
  }
}

function activityFilterClause(filter: ActivityReportDefinition["filter"]): ReturnType<typeof sql> {
  if (filter === null) return sql``;
  const parts: ReturnType<typeof sql>[] = [];
  if (filter.ownerIds !== undefined && filter.ownerIds.length > 0) {
    parts.push(sql`AND a.owner_id = ANY(${buildUuidArray(filter.ownerIds)})`);
  }
  if (filter.activityTypeIds !== undefined && filter.activityTypeIds.length > 0) {
    parts.push(sql`AND a.type_id = ANY(${buildUuidArray(filter.activityTypeIds)})`);
  }
  if (filter.done !== undefined) {
    parts.push(sql`AND a.done = ${filter.done}`);
  }
  return parts.length === 0 ? sql`` : sql.join(parts, sql` `);
}

export function compileActivityReport(
  def: ActivityReportDefinition,
  actor: PermSetUser,
  opts: CompileOptions,
): ReturnType<typeof sql> {
  const groupExpr =
    def.groupBy === null
      ? sql`''`
      : activityGroupExpr(def.groupBy.field, def.groupBy.interval, opts.tz);
  const segmentExpr =
    def.segmentBy === null ? sql`NULL::text` : activitySegmentExpr(def.segmentBy.field);
  const dateColumn =
    def.dateRange.field === "due_at"
      ? sql`a.due_at`
      : def.dateRange.field === "done_at"
        ? sql`a.done_at`
        : sql`a.created_at`;
  const visibility = activityVisibilityPredicate(actor, "a");

  return sql`
    SELECT
      ${groupExpr} AS g,
      ${segmentExpr} AS s,
      ''::text AS c,
      count(*)::int AS count,
      coalesce(sum(coalesce(a.duration_minutes, 0)), 0)::numeric(14,0)::text AS value,
      '0'::text AS weighted
    FROM activities a
    WHERE a.deleted_at IS NULL
      ${dateRangeClause(dateColumn, false, opts.from, opts.to, opts.tz)}
      ${activityFilterClause(def.filter)}
      AND ${visibility}
    GROUP BY 1, 2, 3
  `;
}
