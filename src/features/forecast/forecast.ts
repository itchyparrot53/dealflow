import { sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { formatCents, parseCents, toBase } from "@/features/currency/money";
import { loadRateMap } from "@/features/currency/rates";
import { type MoneyDeal, type RateMap, rateFor, summarize } from "@/features/currency/totals";
import { updateDeal } from "@/features/deals/dealActions";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import { dealVisibilityClause } from "@/features/deals/visibility";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import type { DealVisibilitySession } from "@/types/session";

// Forecast read and the move action. Open deals bucket by expected close month (earlier
// ones into the first month, flagged overdue), won deals by won month, and both convert
// to base with the same summarize() the board and list use. Visibility is the deals-list
// predicate, not a new one.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 12;
const OPEN_CAP = 200;
const NO_DATE_CAP = 100;
const DEFAULT_PROBABILITY = 100;

export const forecastInput = z.object({
  pipelineId: z.string().uuid().optional(),
  startMonth: z.string().regex(MONTH_PATTERN).optional(),
  months: z.number().int().min(1).max(MAX_MONTHS).default(DEFAULT_MONTHS),
  includeWon: z.boolean().default(true),
});

export const moveDealToMonthInput = z.object({
  dealId: z.string().uuid(),
  month: z.string().regex(MONTH_PATTERN),
});

export interface ForecastDeal {
  id: string;
  title: string;
  value: string | null;
  currency: string;
  valueBase: string | null;
  probability: number;
  expectedCloseDate: string | null;
  wonAt: string | null;
  overdue: boolean;
  ownerName: string | null;
  stageName: string;
}

export interface ForecastMonth {
  month: string;
  label: string;
  open: ForecastDeal[];
  won: ForecastDeal[];
  openCount: number;
  total: string;
  weighted: string;
  wonTotal: string;
  excluded: ForecastDeal[];
}

export interface Forecast {
  baseCurrency: string;
  months: ForecastMonth[];
  noDate: ForecastDeal[];
  noDateCount: number;
}

interface ForecastRow {
  id: string;
  title: string;
  value: string | null;
  status: string;
  expectedCloseDate: string | null;
  wonAt: string | null;
  currency: string;
  probability: number;
  ownerName: string | null;
  stageName: string;
}

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthStart(month: string): Date {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, monthIndex, 1));
}

function addMonths(month: string, count: number): string {
  const date = monthStart(month);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 7);
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function monthLabel(month: string): string {
  return MONTH_LABEL.format(monthStart(month));
}

function visibilitySession(actor: PermSetUser): DealVisibilitySession {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
  };
}

function baseValue(value: string | null, currency: string, map: RateMap): string | null {
  if (value === null) return null;
  const rate = rateFor(map, currency);
  if (rate === null) return null;
  return formatCents(toBase(parseCents(value), rate));
}

function monthTotal(
  rows: ForecastDeal[],
  map: RateMap,
): { total: string; weighted: string; excluded: ForecastDeal[] } {
  const money: MoneyDeal[] = rows.map((row) => ({
    id: row.id,
    value: row.value,
    currency: row.currency,
    probability: row.probability,
  }));
  const summary = summarize(money, map);
  return {
    total: formatCents(summary.total),
    weighted: formatCents(summary.weighted),
    excluded: rows.filter((row) => row.value !== null && row.valueBase === null),
  };
}

function bucketRows(
  rows: ForecastRow[],
  byMonth: Map<string, ForecastMonth>,
  first: ForecastMonth | undefined,
  windowStartYmd: string,
  map: RateMap,
): ForecastDeal[] {
  const undated: ForecastDeal[] = [];
  for (const row of rows) {
    if (row.status === "won") {
      if (row.wonAt === null) continue;
      const month = new Date(row.wonAt).toISOString().slice(0, 7);
      byMonth.get(month)?.won.push(toDeal(row, map, false));
      continue;
    }
    const deal = toDeal(row, map, false);
    if (row.expectedCloseDate === null) {
      undated.push(deal);
      continue;
    }
    if (row.expectedCloseDate < windowStartYmd) {
      if (first !== undefined) first.open.push({ ...deal, overdue: true });
      continue;
    }
    byMonth.get(row.expectedCloseDate.slice(0, 7))?.open.push(deal);
  }
  return undated;
}

function toDeal(row: ForecastRow, map: RateMap, overdue: boolean): ForecastDeal {
  return {
    id: row.id,
    title: row.title,
    value: row.value,
    currency: row.currency,
    valueBase: baseValue(row.value, row.currency, map),
    probability: row.probability,
    expectedCloseDate: row.expectedCloseDate,
    wonAt: row.wonAt === null ? null : new Date(row.wonAt).toISOString(),
    overdue,
    ownerName: row.ownerName,
    stageName: row.stageName,
  };
}

export async function getForecast(
  db: DbOrTx,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<Forecast, AppError>> {
  const input = forecastInput.parse(raw);
  const startMonth = input.startMonth ?? currentUtcMonth();
  const windowStart = monthStart(startMonth);
  const windowEnd = monthStart(addMonths(startMonth, input.months));
  const windowStartYmd = windowStart.toISOString().slice(0, 10);
  const visClause = dealVisibilityClause(visibilitySession(actor));
  const pipelineFilter =
    input.pipelineId === undefined ? sql`` : sql`AND d.pipeline_id = ${input.pipelineId}`;
  const wonGate = input.includeWon
    ? sql`OR (d.status = 'won' AND d.won_time >= ${windowStart} AND d.won_time < ${windowEnd})`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.value,
      d.status,
      d.expected_close_date AS "expectedCloseDate",
      d.won_time            AS "wonAt",
      coalesce(dt.currency, (SELECT base_currency FROM settings WHERE id = true), 'USD') AS currency,
      coalesce(dt.probability, sp.probability, ${DEFAULT_PROBABILITY})::int AS probability,
      u.name                AS "ownerName",
      s.name                AS "stageName"
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    JOIN stages s ON s.id = d.stage_id
    JOIN users u ON u.id = d.owner_id
    LEFT JOIN deal_terms dt ON dt.deal_id = d.id
    LEFT JOIN stage_probabilities sp ON sp.stage_id = d.stage_id
    WHERE d.deleted_at IS NULL
      AND d.archived_at IS NULL
      AND p.is_archived = false
      AND (d.status = 'open' ${wonGate})
      ${pipelineFilter}
      AND ${visClause}
  `);
  signal.throwIfAborted();
  const rows = (result as unknown as { rows: ForecastRow[] }).rows;
  const map = await loadRateMap(db, signal);

  const months: ForecastMonth[] = [];
  const byMonth = new Map<string, ForecastMonth>();
  for (let index = 0; index < input.months; index += 1) {
    const month = addMonths(startMonth, index);
    const entry: ForecastMonth = {
      month,
      label: monthLabel(month),
      open: [],
      won: [],
      openCount: 0,
      total: "0.00",
      weighted: "0.00",
      wonTotal: "0.00",
      excluded: [],
    };
    months.push(entry);
    byMonth.set(month, entry);
  }
  const first = months[0];
  const undated = bucketRows(rows, byMonth, first, windowStartYmd, map);

  for (const month of months) {
    month.openCount = month.open.length;
    month.open.sort((a, b) => {
      const dateA = a.expectedCloseDate ?? "";
      const dateB = b.expectedCloseDate ?? "";
      return dateA === dateB ? a.title.localeCompare(b.title) : dateA.localeCompare(dateB);
    });
    const openTotals = monthTotal(month.open, map);
    month.total = openTotals.total;
    month.weighted = openTotals.weighted;
    month.won.sort((a, b) => {
      const byDate = (a.wonAt ?? "").localeCompare(b.wonAt ?? "");
      return byDate === 0 ? a.title.localeCompare(b.title) : byDate;
    });
    const wonSummary = summarize(
      month.won.map((deal) => ({
        id: deal.id,
        value: deal.value,
        currency: deal.currency,
        probability: DEFAULT_PROBABILITY,
      })),
      map,
    );
    month.wonTotal = formatCents(wonSummary.total);
    month.excluded = [
      ...openTotals.excluded,
      ...month.won.filter((deal) => deal.value !== null && deal.valueBase === null),
    ];
    month.open = month.open.slice(0, OPEN_CAP);
    month.won = month.won.slice(0, OPEN_CAP);
  }

  undated.sort((a, b) => a.title.localeCompare(b.title));
  const noDate = undated.slice(0, NO_DATE_CAP);
  return ok({
    baseCurrency: map.base,
    months,
    noDate,
    noDateCount: undated.length,
  });
}

export async function moveDealToMonth(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ dealId: string; expectedCloseDate: string }, AppError>> {
  const input = moveDealToMonthInput.parse(raw);
  // The visibility/edit gate runs first, so an invisible deal is not-found rather than a
  // status refusal that would reveal it exists.
  const editable = await loadEditableDeal(db, actor, input.dealId, signal);
  if (!editable.ok) return err(editable.error);
  const deal = editable.value.deal;
  // Won and lost deals keep their historical close date; the drag only rearranges the
  // open pipeline, so those drops are refused rather than silently changing history.
  if (deal.status !== "open") {
    return err(
      new AppError(ERROR_IDS.DEAL_PRECONDITION, "Only open deals can be re-dated", {
        dealId: input.dealId,
        status: deal.status,
      }),
    );
  }

  const year = Number(input.month.slice(0, 4));
  const monthIndex = Number(input.month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const existingDay =
    deal.expectedCloseDate === null ? 15 : Number(deal.expectedCloseDate.slice(8, 10));
  const day = Math.min(existingDay, lastDay);
  const expectedCloseDate = `${input.month}-${String(day).padStart(2, "0")}`;

  const updated = await updateDeal(
    db,
    actor,
    {
      dealId: input.dealId,
      expectedUpdatedAt: deal.updatedAt.toISOString(),
      expectedCloseDate,
    },
    signal,
  );
  if (!updated.ok) return err(updated.error);
  return ok({ dealId: input.dealId, expectedCloseDate });
}
