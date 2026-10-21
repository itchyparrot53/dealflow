import {
  INSIGHT_MAX_GROUPS,
  INSIGHT_MAX_SEGMENTS,
  INSIGHT_TABLE_MAX_ROWS,
} from "@/constants/insights";
import { formatCents, parseCents, roundDiv, toBase } from "@/features/currency/money";
import { type RateMap, rateFor } from "@/features/currency/totals";
import { fillBuckets } from "./dateRange";
import { isActivityDateField, isDealDateField, type ReportDefinition } from "./definition";
import type { ReportExcludedCurrency, ReportResult, ReportRow } from "./result";

// Turns the one SQL result into the report the UI consumes. Money arrives grouped by currency, so
// this is the only place mixed currencies meet: each currency converts with toBase, a currency
// without a rate is listed in `excluded` (never added unconverted), and groups and segments are
// capped into "Other" after the conversion.

export interface RawReportRow {
  g: string;
  s: string | null;
  c: string;
  count: number;
  value: string;
  weighted: string;
}

export interface ConvertOptions {
  tz: string;
  from: Date | null;
  to: Date | null;
}

interface Entry {
  g: string;
  s: string | null;
  /** Converted money in cents, for a money measure. */
  total: bigint;
  /** Duration in minutes, for sum_duration. */
  minutes: number;
  count: number;
}

interface Totals {
  money: bigint;
  minutes: number;
  count: number;
}

const OTHER = "__other";

type MeasureKind = ReportDefinition["measure"]["kind"];

function isMoney(kind: MeasureKind): boolean {
  return kind === "sum_value" || kind === "avg_value" || kind === "weighted_value";
}

function isDateGroup(def: ReportDefinition): boolean {
  const group = def.groupBy;
  if (group === null) return false;
  return def.entity === "deal" ? isDealDateField(group.field) : isActivityDateField(group.field);
}

/** Ranking weight: money, counts and minutes all compare through the same integer. */
function rank(entry: Entry, money: boolean, duration: boolean): bigint {
  if (money) return entry.total;
  if (duration) return BigInt(Math.round(entry.minutes));
  return BigInt(entry.count);
}

function compareDesc(a: bigint, b: bigint): number {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

function entryKey(g: string, s: string | null): string {
  return `${g}\u0000${s ?? ""}`;
}

function addTo(map: Map<string, Entry>, g: string, s: string | null): Entry {
  const key = entryKey(g, s);
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const entry: Entry = { g, s, total: 0n, minutes: 0, count: 0 };
  map.set(key, entry);
  return entry;
}

function sumBy(
  entries: Iterable<Entry>,
  keyOf: (entry: Entry) => string | null,
  money: boolean,
  duration: boolean,
): Map<string, bigint> {
  const sums = new Map<string, bigint>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key === null) continue;
    sums.set(key, (sums.get(key) ?? 0n) + rank(entry, money, duration));
  }
  return sums;
}

interface Capped {
  kept: Set<string>;
  truncated: boolean;
}

function capByRank(sums: Map<string, bigint>, limit: number, byKey: boolean): Capped {
  const keys = [...sums.keys()];
  if (keys.length <= limit) return { kept: new Set(keys), truncated: false };
  const ordered = keys.sort((a, b) => {
    if (byKey) return a.localeCompare(b);
    return compareDesc(sums.get(a) ?? 0n, sums.get(b) ?? 0n) || a.localeCompare(b);
  });
  return { kept: new Set(ordered.slice(0, limit)), truncated: true };
}

function rollIntoCaps(
  entries: Map<string, Entry>,
  limit: { groups: number; segments: number },
  money: boolean,
  duration: boolean,
  dateGroup: boolean,
): { entries: Map<string, Entry>; truncated: boolean } {
  const groupRanking = sumBy(entries.values(), (entry) => entry.g, money, duration);
  const groups = capByRank(groupRanking, limit.groups, dateGroup);
  const segmentRanking = sumBy(entries.values(), (entry) => entry.s, money, duration);
  const segments = capByRank(segmentRanking, limit.segments, false);

  const rolled = new Map<string, Entry>();
  for (const entry of entries.values()) {
    const g = groups.kept.has(entry.g) ? entry.g : OTHER;
    const s = entry.s === null ? null : segments.kept.has(entry.s) ? entry.s : OTHER;
    const target = addTo(rolled, g, s);
    target.total += entry.total;
    target.minutes += entry.minutes;
    target.count += entry.count;
  }
  return { entries: rolled, truncated: groups.truncated || segments.truncated };
}

function accumulate(
  rows: readonly RawReportRow[],
  def: ReportDefinition,
  map: RateMap,
  entries: Map<string, Entry>,
  totals: Totals,
): Map<string, number> {
  const kind = def.measure.kind;
  const money = isMoney(kind);
  const duration = kind === "sum_duration";
  const excluded = new Map<string, number>();

  for (const row of rows) {
    if (money) {
      const rate = rateFor(map, row.c);
      if (rate === null) {
        excluded.set(row.c, (excluded.get(row.c) ?? 0) + row.count);
        continue;
      }
      const amount = parseCents(kind === "weighted_value" ? row.weighted : row.value);
      const base = toBase(amount, rate);
      const entry = addTo(entries, row.g, row.s);
      entry.total += base;
      entry.count += row.count;
      totals.money += base;
      totals.count += row.count;
      continue;
    }
    const entry = addTo(entries, row.g, row.s);
    entry.count += row.count;
    totals.count += row.count;
    if (duration) {
      const minutes = Number(row.value);
      entry.minutes += minutes;
      totals.minutes += minutes;
    }
  }
  return excluded;
}

function orderedGroups(
  byGroup: Map<string, Entry[]>,
  money: boolean,
  duration: boolean,
  dateGroup: boolean,
): string[] {
  return [...byGroup.keys()].sort((a, b) => {
    if (a === OTHER) return 1;
    if (b === OTHER) return -1;
    if (dateGroup) return a.localeCompare(b);
    const total = (key: string): bigint =>
      (byGroup.get(key) ?? []).reduce((sum, entry) => sum + rank(entry, money, duration), 0n);
    return compareDesc(total(a), total(b)) || a.localeCompare(b);
  });
}

function sortedSegments(list: Entry[], money: boolean, duration: boolean): Entry[] {
  return list.slice().sort((a, b) => {
    if (a.s === null && b.s !== null) return -1;
    if (b.s === null && a.s !== null) return 1;
    if (a.s === OTHER) return 1;
    if (b.s === OTHER) return -1;
    const byRank = compareDesc(rank(a, money, duration), rank(b, money, duration));
    return byRank === 0 ? (a.s ?? "").localeCompare(b.s ?? "") : byRank;
  });
}

function formatValue(entry: Entry, kind: MeasureKind, money: boolean, duration: boolean): string {
  if (money) {
    if (kind === "avg_value") {
      return entry.count === 0 ? "0.00" : formatCents(roundDiv(entry.total, BigInt(entry.count)));
    }
    return formatCents(entry.total);
  }
  if (duration) return String(entry.minutes);
  return String(entry.count);
}

function buildRows(
  byGroup: Map<string, Entry[]>,
  groupOrder: string[],
  kind: MeasureKind,
  money: boolean,
  duration: boolean,
): ReportRow[] {
  const output: ReportRow[] = [];
  for (const g of groupOrder) {
    for (const entry of sortedSegments(byGroup.get(g) ?? [], money, duration)) {
      output.push({
        g: entry.g,
        gLabel: entry.g,
        s: entry.s,
        sLabel: entry.s,
        value: formatValue(entry, kind, money, duration),
        count: entry.count,
      });
    }
  }
  return output;
}

export function convertRows(
  rows: readonly RawReportRow[],
  def: ReportDefinition,
  map: RateMap,
  opts: ConvertOptions,
): ReportResult {
  const kind = def.measure.kind;
  const money = isMoney(kind);
  const duration = kind === "sum_duration";
  const dateGroup = isDateGroup(def);

  const entries = new Map<string, Entry>();
  const totals: Totals = { money: 0n, minutes: 0, count: 0 };
  const excluded = accumulate(rows, def, map, entries, totals);

  // Empty buckets only make sense for an unsegmented date series: each bucket is a group key.
  const group = def.groupBy;
  if (
    group !== null &&
    def.segmentBy === null &&
    opts.from !== null &&
    opts.to !== null &&
    dateGroup
  ) {
    for (const key of fillBuckets(opts.from, opts.to, group.interval ?? "month", opts.tz)) {
      if (!entries.has(entryKey(key, null))) addTo(entries, key, null);
    }
  }

  const capped = rollIntoCaps(
    entries,
    { groups: INSIGHT_MAX_GROUPS, segments: INSIGHT_MAX_SEGMENTS },
    money,
    duration,
    dateGroup,
  );
  let truncated = capped.truncated;

  const byGroup = new Map<string, Entry[]>();
  for (const entry of capped.entries.values()) {
    const list = byGroup.get(entry.g) ?? [];
    list.push(entry);
    byGroup.set(entry.g, list);
  }

  const output = buildRows(
    byGroup,
    orderedGroups(byGroup, money, duration, dateGroup),
    kind,
    money,
    duration,
  );
  if (output.length > INSIGHT_TABLE_MAX_ROWS) {
    truncated = true;
    output.length = INSIGHT_TABLE_MAX_ROWS;
  }

  const excludedRows: ReportExcludedCurrency[] = [...excluded.entries()]
    .map(([currency, count]) => ({ currency, count }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const totalEntry: Entry = {
    g: "",
    s: null,
    total: totals.money,
    minutes: totals.minutes,
    count: totals.count,
  };

  return {
    baseCurrency: map.base,
    measure: kind,
    rows: output,
    total: {
      value: formatValue(totalEntry, kind, money, duration),
      count: totals.count,
    },
    excluded: excludedRows,
    truncated,
    generatedAt: new Date().toISOString(),
  };
}
