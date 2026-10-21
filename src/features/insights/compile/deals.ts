import { sql } from "drizzle-orm";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DealReportDefinition } from "../definition";
import {
  type CompileOptions,
  dateRangeClause,
  dealCurrencySql,
  dealGroupExpr,
  dealSegmentExpr,
  filterClause,
  visibilitySession,
} from "./shared";

// One grouped query per deal report. The database never adds values across currencies: the group
// key includes the currency, and convert.ts converts each currency's sum to base in TypeScript.

function dateColumn(field: DealReportDefinition["dateRange"]["field"]) {
  switch (field) {
    case "created_at":
      return sql`d.created_at`;
    case "won_at":
      return sql`d.won_time`;
    case "lost_at":
      return sql`d.lost_time`;
    case "expected_close_date":
      return sql`d.expected_close_date`;
  }
}

export function compileDealReport(
  def: DealReportDefinition,
  actor: PermSetUser,
  opts: CompileOptions,
): ReturnType<typeof sql> {
  const groupExpr =
    def.groupBy === null
      ? sql`''`
      : dealGroupExpr(def.groupBy.field, def.groupBy.interval, opts.tz);
  const segmentExpr =
    def.segmentBy === null ? sql`NULL::text` : dealSegmentExpr(def.segmentBy.field);
  const isDateColumn = def.dateRange.field === "expected_close_date";
  const visibility = dealVisibilityClause(visibilitySession(actor));

  // `stages` and `organizations` are joined for the saved-filter AST (rotting reads s.rotting_days,
  // orgName reads o.name); the deals list makes the same joins.
  return sql`
    SELECT
      ${groupExpr} AS g,
      ${segmentExpr} AS s,
      ${dealCurrencySql()} AS c,
      count(*)::int AS count,
      coalesce(sum(d.value), 0)::numeric(14,2)::text AS value,
      coalesce(sum(d.value * coalesce(dt.probability, sp.probability, 100) / 100.0), 0)::numeric(14,2)::text AS weighted
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    JOIN stages s ON s.id = d.stage_id
    LEFT JOIN organizations o ON o.id = d.org_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    LEFT JOIN stage_probabilities sp ON sp.stage_id = d.stage_id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      ${dateRangeClause(dateColumn(def.dateRange.field), isDateColumn, opts.from, opts.to, opts.tz)}
      ${filterClause(def.filter, opts.tz)}
      AND ${visibility}
    GROUP BY 1, 2, 3
  `;
}
