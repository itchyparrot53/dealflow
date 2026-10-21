// Average and median size of deals won in the range, plus how long they took to win.
// One scan over the same set for both, since "the deals won in this period" is the only
// population either metric cares about.
// Values convert to base per deal before averaging or taking the median, because an average
// across currencies is only meaningful after conversion. Deals whose currency has no rate are
// listed in `excluded` and left out.
// Windows on won_time (see dealPerformance for why), and applies dealVisibilityClause.
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dealCurrencySql } from "@/features/currency/dealCurrencySql";
import { addExcluded, excludedList } from "@/features/currency/excluded";
import { formatCents, parseCents, roundDiv, toBase } from "@/features/currency/money";
import { loadRateMap } from "@/features/currency/rates";
import { rateFor } from "@/features/currency/totals";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import { ownerFilterClause } from "@/features/stats/ownerIds";
import type { DashboardFilters, WonDealStats } from "@/types/stats";

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
  value: string | null;
  currency: string;
  cycleDays: number | null;
}

const EMPTY: WonDealStats = {
  avgValue: null,
  medianValue: null,
  avgCycleDays: null,
  medianCycleDays: null,
  excluded: [],
};

function comparison(a: number, b: number): number {
  return a - b;
}

function medianNumber(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort(comparison);
  const mid = (sorted.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  const low = sorted[lo] ?? 0;
  const high = sorted[hi] ?? low;
  return lo === hi ? low : (low + high) / 2;
}

function medianCents(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = (sorted.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  const low = sorted[lo] ?? 0n;
  const high = sorted[hi] ?? low;
  return lo === hi ? low : roundDiv(low + high, 2n);
}

export async function wonDealStats(
  db: Db,
  actor: PermSetUser,
  filters: DashboardFilters,
  signal: AbortSignal,
): Promise<WonDealStats> {
  signal.throwIfAborted();

  const visClause = dealVisibilityClause(toSession(actor));
  const ownerClause = ownerFilterClause(sql`d.owner_id`, filters.owners);
  const pipelineClause =
    filters.pipelineId !== null ? sql`AND d.pipeline_id = ${filters.pipelineId}` : sql``;

  const result = await db.execute(sql`
    SELECT
      d.value::text AS "value",
      ${dealCurrencySql()} AS "currency",
      extract(epoch FROM (d.won_time - d.created_at)) / 86400 AS "cycleDays"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND d.status = 'won'
      AND d.won_time >= ${filters.from}::date
      AND d.won_time < ${filters.to}::date + INTERVAL '1 day'
      ${pipelineClause}
      ${ownerClause}
      AND ${visClause}
  `);

  signal.throwIfAborted();

  const rows = (result as unknown as { rows: Row[] }).rows;
  if (rows.length === 0) return EMPTY;

  const map = await loadRateMap(db, signal);
  const converted: bigint[] = [];
  const cycleDays: number[] = [];
  const excluded = new Map<string, number>();
  for (const row of rows) {
    if (row.cycleDays !== null) cycleDays.push(Number(row.cycleDays));
    // A deal with no value contributes no money and is not part of the size average, matching
    // the SQL avg()/percentile_cont() this replaced.
    if (row.value === null) continue;
    const rate = rateFor(map, row.currency);
    if (rate === null) {
      addExcluded(excluded, row.currency, 1);
      continue;
    }
    converted.push(toBase(parseCents(row.value), rate));
  }

  const total = converted.reduce((sum, cents) => sum + cents, 0n);
  const median = medianCents(converted);
  const cycleMedian = medianNumber(cycleDays);

  return {
    avgValue:
      converted.length === 0 ? null : formatCents(roundDiv(total, BigInt(converted.length))),
    medianValue: median === null ? null : formatCents(median),
    avgCycleDays:
      cycleDays.length === 0
        ? null
        : cycleDays.reduce((sum, days) => sum + days, 0) / cycleDays.length,
    medianCycleDays: cycleMedian,
    excluded: excludedList(excluded),
  };
}
