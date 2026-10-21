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
import { type GoalPeriod, periodDays } from "./goalPeriod";
import {
  activityEvent,
  activityTypeClause,
  assigneeClause,
  dealEvent,
  goalSession,
  pipelineClause,
} from "./goalSql";

export interface GoalSeriesPoint {
  day: string;
  actual: string;
  excluded?: ExcludedCurrency[];
}

interface DayTotal {
  day: string;
  count: number;
}

interface DayMoney extends DayTotal {
  currency: string;
  value: string;
}

interface DayAcc {
  count: number;
  cents: bigint;
  excluded: Map<string, number>;
}

async function dealDays(
  db: Db,
  actor: PermSetUser,
  goal: Goal,
  from: string,
  through: string,
  signal: AbortSignal,
): Promise<DayMoney[]> {
  const { at, state } = dealEvent(goal);
  const result = await db.execute(sql`
    SELECT ${at}::date::text AS "day",
           ${dealCurrencySql()} AS "currency",
           count(*)::int AS "count",
           coalesce(sum(d.value), 0)::numeric(14,2)::text AS "value"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND ${state} ${at} >= ${from}::date
      AND ${at} < ${through}::date + INTERVAL '1 day'
      ${pipelineClause(goal, sql`d.pipeline_id`)}
      ${assigneeClause(goal, sql`d.owner_id`)}
      AND ${dealVisibilityClause(goalSession(actor))}
    GROUP BY 1, 2
  `);
  signal.throwIfAborted();
  return (result as unknown as { rows: DayMoney[] }).rows;
}

async function activityDays(
  db: Db,
  actor: PermSetUser,
  goal: Goal,
  from: string,
  through: string,
  signal: AbortSignal,
): Promise<DayTotal[]> {
  const { at, state } = activityEvent(goal);
  const dealPipelineClause =
    goal.pipelineId !== null
      ? sql`AND EXISTS (
          SELECT 1 FROM deals d3 WHERE d3.id = a.deal_id AND d3.pipeline_id = ${goal.pipelineId}
        )`
      : sql``;
  const result = await db.execute(sql`
    SELECT ${at}::date::text AS "day", count(*)::int AS "count"
    FROM activities a
    WHERE a.deleted_at IS NULL
      AND ${state} ${at} >= ${from}::date
      AND ${at} < ${through}::date + INTERVAL '1 day'
      ${activityTypeClause(goal)}
      ${dealPipelineClause}
      ${assigneeClause(goal, sql`a.assignee_id`)}
      AND ${activityVisibilityPredicate(actor, "a")}
    GROUP BY 1
  `);
  signal.throwIfAborted();
  return (result as unknown as { rows: DayTotal[] }).rows;
}

function accumulateCount(days: string[], totals: Map<string, number>): GoalSeriesPoint[] {
  let running = 0;
  return days.map((day) => {
    running += totals.get(day) ?? 0;
    return { day, actual: String(running) };
  });
}

function accumulateMoney(days: string[], totals: Map<string, DayAcc>): GoalSeriesPoint[] {
  let running = 0n;
  return days.map((day) => {
    const acc = totals.get(day);
    if (acc !== undefined) running += acc.cents;
    return {
      day,
      actual: formatCents(running),
      excluded: acc === undefined ? [] : excludedList(acc.excluded),
    };
  });
}

export async function goalSeries(
  db: Db,
  actor: PermSetUser,
  goal: Goal,
  period: GoalPeriod,
  on: string,
  signal: AbortSignal,
): Promise<GoalSeriesPoint[]> {
  signal.throwIfAborted();
  const days = periodDays(period).filter((d) => d <= on);
  const through = days.at(-1);
  if (through === undefined) return [];

  if (goal.subject === "activity") {
    const rows = await activityDays(db, actor, goal, period.start, through, signal);
    return accumulateCount(days, new Map(rows.map((r) => [r.day, r.count])));
  }

  const rows = await dealDays(db, actor, goal, period.start, through, signal);
  if (goal.metric === "count") {
    return accumulateCount(days, new Map(rows.map((r) => [r.day, r.count])));
  }

  const map = await loadRateMap(db, signal);
  const byDay = new Map<string, DayAcc>();
  for (const row of rows) {
    const acc = byDay.get(row.day) ?? { count: 0, cents: 0n, excluded: new Map<string, number>() };
    byDay.set(row.day, acc);
    acc.count += row.count;
    const rate = rateFor(map, row.currency);
    if (rate === null) addExcluded(acc.excluded, row.currency, row.count);
    else acc.cents += toBase(parseCents(row.value), rate);
  }
  return accumulateMoney(days, byDay);
}
