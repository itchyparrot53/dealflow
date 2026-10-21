// Why deals were lost in the range, by count and value.
// Two write paths land a reason: MarkLostDialog sets lost_reason_id, while the deal-update
// API accepts free text in lost_reason. Rows are keyed on the id when there is one and fall
// back to the text, so a typed reason is not silently filed under "no reason".
// The query groups by reason and currency; values convert to base in TypeScript.
// Windows on lost_time, and applies dealVisibilityClause.
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
import type { DashboardFilters, LostReasonCount } from "@/types/stats";

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
  reasonId: string | null;
  name: string | null;
  currency: string;
  count: number;
  value: string;
}

interface Acc {
  reasonId: string | null;
  name: string | null;
  count: number;
  cents: bigint;
  excluded: Map<string, number>;
}

export async function lostReasonBreakdown(
  db: Db,
  actor: PermSetUser,
  filters: DashboardFilters,
  signal: AbortSignal,
): Promise<LostReasonCount[]> {
  signal.throwIfAborted();

  const visClause = dealVisibilityClause(toSession(actor));
  const ownerClause = ownerFilterClause(sql`d.owner_id`, filters.owners);
  const pipelineClause =
    filters.pipelineId !== null ? sql`AND d.pipeline_id = ${filters.pipelineId}` : sql``;

  const result = await db.execute(sql`
    SELECT
      d.lost_reason_id AS "reasonId",
      coalesce(lr.name, d.lost_reason) AS "name",
      ${dealCurrencySql()} AS "currency",
      count(*)::int AS "count",
      coalesce(sum(d.value), 0)::numeric(14,2)::text AS "value"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN lost_reasons lr ON lr.id = d.lost_reason_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND d.status = 'lost'
      AND d.lost_time >= ${filters.from}::date
      AND d.lost_time < ${filters.to}::date + INTERVAL '1 day'
      ${pipelineClause}
      ${ownerClause}
      AND ${visClause}
    GROUP BY 1, 2, 3
  `);

  signal.throwIfAborted();

  const rows = (result as unknown as { rows: Row[] }).rows;
  if (rows.length === 0) return [];
  const map = await loadRateMap(db, signal);
  const byReason = new Map<string, Acc>();
  for (const row of rows) {
    const key = `${row.reasonId ?? "text"}:${row.name ?? ""}`;
    const acc = byReason.get(key) ?? {
      reasonId: row.reasonId,
      name: row.name,
      count: 0,
      cents: 0n,
      excluded: new Map<string, number>(),
    };
    byReason.set(key, acc);
    acc.count += row.count;
    const rate = rateFor(map, row.currency);
    if (rate === null) addExcluded(acc.excluded, row.currency, row.count);
    else acc.cents += toBase(parseCents(row.value), rate);
  }

  return [...byReason.values()]
    .map((acc) => ({
      reasonId: acc.reasonId,
      name: acc.name,
      count: acc.count,
      value: formatCents(acc.cents),
      excluded: excludedList(acc.excluded),
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
}
