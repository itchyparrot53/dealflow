// Per-stage open-deal counts and values for the dashboard (NOT the kanban board:
// the board uses deal.stageSums/dealRepo). Requires FROM deals d JOIN pipelines p
// ON p.id = d.pipeline_id so dealVisibilityClause can gate on p.visibility_group_id.
// The query groups by stage and currency; totals convert to base in TypeScript.
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
import type { OwnerIdFilter, StageSum } from "@/types/stats";

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
  stageId: string;
  name: string;
  order: number;
  dealCount: number;
  currency: string;
  total: string;
}

interface Acc {
  stageId: string;
  name: string;
  order: number;
  dealCount: number;
  cents: bigint;
  excluded: Map<string, number>;
}

export async function stageSums(
  db: Db,
  actor: PermSetUser,
  pipelineId: string,
  owners: OwnerIdFilter,
  signal: AbortSignal,
): Promise<StageSum[]> {
  signal.throwIfAborted();

  const visClause = dealVisibilityClause(toSession(actor));
  const ownerClause = ownerFilterClause(sql`d.owner_id`, owners);

  // JOIN stages so each row carries its own name (mirrors how funnel.ts returns
  // names). The widget then renders names for ANY pipeline, not only the settings
  // default pipeline. Semantics otherwise unchanged: only stages that hold at
  // least one visible open deal appear.
  const result = await db.execute(sql`
    SELECT
      d.stage_id                                              AS "stageId",
      s.name                                                  AS name,
      s."order"                                               AS "order",
      ${dealCurrencySql()}                                    AS "currency",
      count(*)::int                                           AS "dealCount",
      coalesce(sum(d.value), 0)::numeric(14,2)::text          AS total
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    JOIN stages s ON s.id = d.stage_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.pipeline_id = ${pipelineId}
      AND d.status = 'open'
      AND d.deleted_at IS NULL
      AND d.archived_at IS NULL
      ${ownerClause}
      AND ${visClause}
    GROUP BY 1, 2, 3, 4
    ORDER BY s."order" ASC
  `);

  signal.throwIfAborted();

  const rows = (result as unknown as { rows: Row[] }).rows;
  if (rows.length === 0) return [];
  const map = await loadRateMap(db, signal);
  const byStage = new Map<string, Acc>();
  for (const row of rows) {
    const acc = byStage.get(row.stageId) ?? {
      stageId: row.stageId,
      name: row.name,
      order: row.order,
      dealCount: 0,
      cents: 0n,
      excluded: new Map<string, number>(),
    };
    byStage.set(row.stageId, acc);
    acc.dealCount += row.dealCount;
    const rate = rateFor(map, row.currency);
    if (rate === null) addExcluded(acc.excluded, row.currency, row.dealCount);
    else acc.cents += toBase(parseCents(row.total), rate);
  }

  return [...byStage.values()]
    .sort((a, b) => a.order - b.order)
    .map((acc) => ({
      stageId: acc.stageId,
      name: acc.name,
      order: acc.order,
      dealCount: acc.dealCount,
      total: formatCents(acc.cents),
      excluded: excludedList(acc.excluded),
    }));
}
