// What a goal has actually booked inside one period.
//
// Two scopes are at play and they are not the same: the goal names WHOSE work counts (a user,
// a team's members, or everyone), while the viewer's own visibility still decides which deals
// they are allowed to see at all. Reading a colleague's goal must never surface a deal that
// colleague can see and the viewer cannot.
//
// A value goal sums deal value, so the query groups by currency and the values convert to the
// base currency here; a currency without a rate is reported in `excluded` and left out.
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { Goal } from "@/db/schema/goals";
import { dealCurrencySql } from "@/features/currency/dealCurrencySql";
import { addExcluded, excludedList } from "@/features/currency/excluded";
import { formatCents, parseCents, toBase } from "@/features/currency/money";
import { loadRateMap } from "@/features/currency/rates";
import { rateFor } from "@/features/currency/totals";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import { activityVisibilityPredicate } from "@/features/stats/activityVisibilitySql";
import type { ExcludedCurrency } from "@/types/stats";
import type { GoalPeriod } from "./goalPeriod";
import {
  activityEvent,
  activityTypeClause,
  assigneeClause,
  dealEvent,
  goalSession,
  pipelineClause,
} from "./goalSql";

export interface GoalActual {
  value: string;
  excluded: ExcludedCurrency[];
}

interface Totals {
  count: number;
  cents: bigint;
  excluded: ExcludedCurrency[];
}

interface DealRow {
  currency: string;
  count: number;
  value: string;
}

async function dealTotals(
  db: Db,
  actor: PermSetUser,
  goal: Goal,
  period: GoalPeriod,
  signal: AbortSignal,
): Promise<Totals> {
  const from = sql`${period.start}::date`;
  const toExclusive = sql`${period.end}::date + INTERVAL '1 day'`;
  const { at, state } = dealEvent(goal);
  const windowClause = sql`${state} ${at} >= ${from} AND ${at} < ${toExclusive}`;

  const result = await db.execute(sql`
    SELECT ${dealCurrencySql()} AS "currency",
           count(*)::int AS "count",
           coalesce(sum(d.value), 0)::numeric(14,2)::text AS "value"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND ${windowClause}
      ${pipelineClause(goal, sql`d.pipeline_id`)}
      ${assigneeClause(goal, sql`d.owner_id`)}
      AND ${dealVisibilityClause(goalSession(actor))}
    GROUP BY 1
  `);
  signal.throwIfAborted();

  const rows = (result as unknown as { rows: DealRow[] }).rows;
  const map = rows.length === 0 ? null : await loadRateMap(db, signal);
  let count = 0;
  let cents = 0n;
  const excluded = new Map<string, number>();
  for (const row of rows) {
    count += row.count;
    if (map === null) continue;
    const rate = rateFor(map, row.currency);
    if (rate === null) addExcluded(excluded, row.currency, row.count);
    else cents += toBase(parseCents(row.value), rate);
  }
  return { count, cents, excluded: excludedList(excluded) };
}

async function activityTotals(
  db: Db,
  actor: PermSetUser,
  goal: Goal,
  period: GoalPeriod,
  signal: AbortSignal,
): Promise<Totals> {
  const from = sql`${period.start}::date`;
  const toExclusive = sql`${period.end}::date + INTERVAL '1 day'`;
  const { at, state } = activityEvent(goal);
  const windowClause = sql`${state} ${at} >= ${from} AND ${at} < ${toExclusive}`;
  const dealPipelineClause =
    goal.pipelineId !== null
      ? sql`AND EXISTS (
          SELECT 1 FROM deals d3 WHERE d3.id = a.deal_id AND d3.pipeline_id = ${goal.pipelineId}
        )`
      : sql``;

  const result = await db.execute(sql`
    SELECT count(*)::int AS "count"
    FROM activities a
    WHERE a.deleted_at IS NULL
      AND ${windowClause}
      ${activityTypeClause(goal)}
      ${dealPipelineClause}
      ${assigneeClause(goal, sql`a.assignee_id`)}
      AND ${activityVisibilityPredicate(actor, "a")}
  `);
  signal.throwIfAborted();
  const row = (result as unknown as { rows: { count: number }[] }).rows[0];
  return { count: row?.count ?? 0, cents: 0n, excluded: [] };
}

// The booked figure for one goal in one period, as a decimal string in the goal's own metric.
export async function goalActual(
  db: Db,
  actor: PermSetUser,
  goal: Goal,
  period: GoalPeriod,
  signal: AbortSignal,
): Promise<GoalActual> {
  signal.throwIfAborted();
  const totals =
    goal.subject === "deal"
      ? await dealTotals(db, actor, goal, period, signal)
      : await activityTotals(db, actor, goal, period, signal);
  return {
    value: goal.metric === "value" ? formatCents(totals.cents) : String(totals.count),
    excluded: totals.excluded,
  };
}
