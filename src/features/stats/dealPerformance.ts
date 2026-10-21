// Deal counters for the dashboard: added, won, lost, and an open snapshot.
// Each counter windows on the column that records its own event. dealUpdate.ts stamps
// won_time/lost_time on the status transition, so a closed deal always carries the date it
// closed. Open deals have no close date, so they are a resting-state snapshot rather than a
// windowed count.
// SQL groups by currency and the four windows in one scan; the values convert to base in
// TypeScript, because the database must never add two currencies together.
// Always applies dealVisibilityPredicate via dealVisibilityClause (requires
// FROM deals d JOIN pipelines p ON p.id = d.pipeline_id).
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dealCurrencySql } from "@/features/currency/dealCurrencySql";
import { addExcluded, excludedList } from "@/features/currency/excluded";
import { formatCents, parseCents, type Rate, toBase } from "@/features/currency/money";
import { loadRateMap } from "@/features/currency/rates";
import { rateFor } from "@/features/currency/totals";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import { ownerFilterClause } from "@/features/stats/ownerIds";
import type { DashboardFilters, DealCounters, MoneyBucket } from "@/types/stats";

// Build a DealVisibilitySession from a PermSetUser (same shape, different names).
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

interface CounterRow {
  currency: string;
  addedCount: number;
  addedValue: string;
  wonCount: number;
  wonValue: string;
  lostCount: number;
  lostValue: string;
  openCount: number;
  openValue: string;
}

interface BucketAcc {
  count: number;
  cents: bigint;
  excluded: Map<string, number>;
}

function emptyAcc(): BucketAcc {
  return { count: 0, cents: 0n, excluded: new Map() };
}

function addBucket(
  acc: BucketAcc,
  currency: string,
  count: number,
  value: string,
  rate: Rate | null,
): void {
  acc.count += count;
  if (count === 0) return;
  if (rate === null) {
    addExcluded(acc.excluded, currency, count);
    return;
  }
  acc.cents += toBase(parseCents(value), rate);
}

function toBucket(acc: BucketAcc): MoneyBucket {
  return { count: acc.count, value: formatCents(acc.cents), excluded: excludedList(acc.excluded) };
}

const EMPTY = (): MoneyBucket => ({ count: 0, value: "0.00", excluded: [] });

export async function dealPerformance(
  db: Db,
  actor: PermSetUser,
  filters: DashboardFilters,
  signal: AbortSignal,
): Promise<DealCounters> {
  signal.throwIfAborted();

  const visClause = dealVisibilityClause(toSession(actor));
  const ownerClause = ownerFilterClause(sql`d.owner_id`, filters.owners);
  const pipelineClause =
    filters.pipelineId !== null ? sql`AND d.pipeline_id = ${filters.pipelineId}` : sql``;

  const from = sql`${filters.from}::date`;
  const toExclusive = sql`${filters.to}::date + INTERVAL '1 day'`;
  const addedIn = sql`d.created_at >= ${from} AND d.created_at < ${toExclusive}`;
  const wonIn = sql`d.status = 'won' AND d.won_time >= ${from} AND d.won_time < ${toExclusive}`;
  const lostIn = sql`d.status = 'lost' AND d.lost_time >= ${from} AND d.lost_time < ${toExclusive}`;
  const isOpen = sql`d.status = 'open'`;

  const result = await db.execute(sql`
    SELECT
      ${dealCurrencySql()} AS "currency",
      count(*) filter (where ${addedIn})::int AS "addedCount",
      coalesce(sum(d.value) filter (where ${addedIn}), 0)::numeric(14,2)::text AS "addedValue",
      count(*) filter (where ${wonIn})::int AS "wonCount",
      coalesce(sum(d.value) filter (where ${wonIn}), 0)::numeric(14,2)::text AS "wonValue",
      count(*) filter (where ${lostIn})::int AS "lostCount",
      coalesce(sum(d.value) filter (where ${lostIn}), 0)::numeric(14,2)::text AS "lostValue",
      count(*) filter (where ${isOpen})::int AS "openCount",
      coalesce(sum(d.value) filter (where ${isOpen}), 0)::numeric(14,2)::text AS "openValue"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      ${pipelineClause}
      ${ownerClause}
      AND ${visClause}
    GROUP BY 1
  `);

  signal.throwIfAborted();

  const rows = (result as unknown as { rows: CounterRow[] }).rows;
  if (rows.length === 0) {
    return { added: EMPTY(), won: EMPTY(), lost: EMPTY(), open: EMPTY() };
  }
  const map = await loadRateMap(db, signal);
  const added = emptyAcc();
  const won = emptyAcc();
  const lost = emptyAcc();
  const open = emptyAcc();
  for (const row of rows) {
    const rate = rateFor(map, row.currency);
    addBucket(added, row.currency, row.addedCount, row.addedValue, rate);
    addBucket(won, row.currency, row.wonCount, row.wonValue, rate);
    addBucket(lost, row.currency, row.lostCount, row.lostValue, rate);
    addBucket(open, row.currency, row.openCount, row.openValue, rate);
  }

  return {
    added: toBucket(added),
    won: toBucket(won),
    lost: toBucket(lost),
    open: toBucket(open),
  };
}
