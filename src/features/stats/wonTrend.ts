// Won deal count and value per month across the dashboard range. The only stats query that
// answers "which way is this going" rather than "where does it rest right now".
// The query groups by month and currency; each month's value converts to base in TypeScript.
// Windows on won_time (see dealPerformance for why) and applies dealVisibilityClause.
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dealCurrencySql } from "@/features/currency/dealCurrencySql";
import { addExcluded, excludedList } from "@/features/currency/excluded";
import { formatCents, parseCents, toBase } from "@/features/currency/money";
import { loadRateMap } from "@/features/currency/rates";
import { rateFor } from "@/features/currency/totals";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import { ownerFilterClause } from "@/features/stats/ownerIds";
import type { DashboardFilters, WonTrendPoint } from "@/types/stats";
import { monthsInRange, windowStart } from "./monthBuckets";

function toSession(actor: PermSetUser) {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
  };
}

interface Row {
  month: string;
  currency: string;
  count: number;
  value: string;
}

interface Acc {
  count: number;
  cents: bigint;
  excluded: Map<string, number>;
}

export async function wonTrend(
  db: Db,
  actor: PermSetUser,
  filters: DashboardFilters,
  signal: AbortSignal,
): Promise<WonTrendPoint[]> {
  signal.throwIfAborted();

  const months = monthsInRange(filters.from, filters.to);
  const start = windowStart(filters.from, months);
  if (start === null) return [];

  const visClause = dealVisibilityClause(toSession(actor));
  const ownerClause = ownerFilterClause(sql`d.owner_id`, filters.owners);
  const pipelineClause =
    filters.pipelineId !== null ? sql`AND d.pipeline_id = ${filters.pipelineId}` : sql``;

  const result = await db.execute(sql`
    SELECT
      to_char(date_trunc('month', d.won_time), 'YYYY-MM') AS "month",
      ${dealCurrencySql()} AS "currency",
      count(*)::int AS "count",
      coalesce(sum(d.value), 0)::numeric(14,2)::text AS "value"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND d.status = 'won'
      AND d.won_time >= ${start}::date
      AND d.won_time < ${filters.to}::date + INTERVAL '1 day'
      ${pipelineClause}
      ${ownerClause}
      AND ${visClause}
    GROUP BY 1, 2
  `);

  signal.throwIfAborted();

  const rows = (result as unknown as { rows: Row[] }).rows;
  const map = rows.length === 0 ? null : await loadRateMap(db, signal);
  const byMonth = new Map<string, Acc>();
  for (const row of rows) {
    const acc = byMonth.get(row.month) ?? {
      count: 0,
      cents: 0n,
      excluded: new Map<string, number>(),
    };
    byMonth.set(row.month, acc);
    acc.count += row.count;
    if (map === null) continue;
    const rate = rateFor(map, row.currency);
    if (rate === null) addExcluded(acc.excluded, row.currency, row.count);
    else acc.cents += toBase(parseCents(row.value), rate);
  }

  return months.map((month) => {
    const acc = byMonth.get(month);
    if (acc === undefined) return { month, count: 0, value: "0.00", excluded: [] };
    return {
      month,
      count: acc.count,
      value: formatCents(acc.cents),
      excluded: excludedList(acc.excluded),
    };
  });
}
