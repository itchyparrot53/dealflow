import { inArray, type SQL, sql } from "drizzle-orm";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { isSourceChannelKey, SOURCE_CHANNELS } from "@/constants/sourceChannels";
import type { Db } from "@/db/client";
import { activityTypes, pipelines, stages, users } from "@/db/schema";
import { filterToSql } from "@/features/saved-filters/filterAst";
import type { FilterDefinition } from "@/features/saved-filters/schemas";
import type { DealVisibilitySession } from "@/types/session";
import { bucketLabel, localDateKey } from "../dateRange";
import type { Interval, ReportDefinition } from "../definition";
import type { ReportResult } from "../result";

// Pieces shared by the deal and activity compilers: date grouping, range and filter clauses, the
// currency expression, and the batched label lookup every report runs after its one query.

const S = INSIGHTS_STRINGS;

/** The visibility predicate's input, built from the actor exactly like the stats and forecast. */
export function visibilitySession(actor: {
  id: string;
  type: string;
  isActive: boolean;
  groupIds: ReadonlySet<string>;
  managedUserIds?: ReadonlySet<string>;
}): DealVisibilitySession {
  return {
    userId: actor.id,
    isAdmin: actor.type === "admin",
    isActive: actor.isActive,
    sessionLive: true,
    visibilityGroupIds: Array.from(actor.groupIds),
    managedUserIds: Array.from(actor.managedUserIds ?? []),
  };
}

export interface CompileOptions {
  tz: string;
  from: Date | null;
  to: Date | null;
}

/**
 * A time-zone-aware bucket key matching bucketKey(): the timestamp is shifted into the viewer's
 * zone before truncating, so a late-evening UTC deal lands in the viewer's month.
 */
export function timestampGroupExpr(column: SQL, interval: Interval, tz: string): SQL {
  const truncated = sql`date_trunc(${interval}, ${column} AT TIME ZONE ${tz})`;
  switch (interval) {
    case "day":
      return sql`to_char(${truncated}, 'YYYY-MM-DD')`;
    case "week":
      return sql`to_char(${truncated}, 'IYYY-"W"IW')`;
    case "month":
      return sql`to_char(${truncated}, 'YYYY-MM')`;
    case "quarter":
      return sql`to_char(${truncated}, 'YYYY"-Q"Q')`;
    case "year":
      return sql`to_char(${truncated}, 'YYYY')`;
  }
}

/** A date column has no zone, so it is never shifted (6.3). */
export function dateColumnGroupExpr(column: SQL, interval: Interval): SQL {
  const truncated = sql`date_trunc(${interval}, ${column})`;
  switch (interval) {
    case "day":
      return sql`to_char(${truncated}, 'YYYY-MM-DD')`;
    case "week":
      return sql`to_char(${truncated}, 'IYYY-"W"IW')`;
    case "month":
      return sql`to_char(${truncated}, 'YYYY-MM')`;
    case "quarter":
      return sql`to_char(${truncated}, 'YYYY"-Q"Q')`;
    case "year":
      return sql`to_char(${truncated}, 'YYYY')`;
  }
}

export function dateRangeClause(
  column: SQL,
  isDateColumn: boolean,
  from: Date | null,
  to: Date | null,
  tz: string,
): SQL {
  if (from === null || to === null) return sql``;
  if (isDateColumn) {
    return sql`AND ${column} >= ${localDateKey(from, tz)}::date AND ${column} < ${localDateKey(to, tz)}::date`;
  }
  return sql`AND ${column} >= ${from.toISOString()}::timestamptz AND ${column} < ${to.toISOString()}::timestamptz`;
}

export function filterClause(filter: FilterDefinition | null, tz: string): SQL {
  if (filter === null) return sql``;
  return sql`AND ${filterToSql(filter, { timeZone: tz })}`;
}

/** The deal's currency: its terms row, else the install base currency, else USD. */
export function dealCurrencySql(): SQL {
  return sql`coalesce(dt.currency, (SELECT base_currency FROM settings WHERE id = true), 'USD')`;
}

export function dealGroupExpr(field: string, interval: Interval | undefined, tz: string): SQL {
  switch (field) {
    case "stage":
      return sql`d.stage_id::text`;
    case "pipeline":
      return sql`d.pipeline_id::text`;
    case "owner":
      return sql`d.owner_id::text`;
    case "status":
      return sql`d.status::text`;
    case "label":
      // Deals store label names, and a deal can carry several. The first is the primary one; one
      // row per deal keeps counts and money from double counting.
      return sql`coalesce(d.labels[1], '')`;
    case "lost_reason":
      return sql`coalesce(d.lost_reason, '')`;
    case "source_channel":
      return sql`coalesce(d.source_channel, '')`;
    case "currency":
      return dealCurrencySql();
    case "created_at":
      return timestampGroupExpr(sql`d.created_at`, interval ?? "month", tz);
    case "won_at":
      return timestampGroupExpr(sql`d.won_time`, interval ?? "month", tz);
    case "lost_at":
      return timestampGroupExpr(sql`d.lost_time`, interval ?? "month", tz);
    case "expected_close_date":
      return dateColumnGroupExpr(sql`d.expected_close_date`, interval ?? "month");
    default:
      return sql`''`;
  }
}

export function dealSegmentExpr(field: string): SQL {
  switch (field) {
    case "stage":
      return sql`d.stage_id::text`;
    case "pipeline":
      return sql`d.pipeline_id::text`;
    case "owner":
      return sql`d.owner_id::text`;
    case "status":
      return sql`d.status::text`;
    case "label":
      return sql`coalesce(d.labels[1], '')`;
    case "lost_reason":
      return sql`coalesce(d.lost_reason, '')`;
    case "source_channel":
      return sql`coalesce(d.source_channel, '')`;
    case "currency":
      return dealCurrencySql();
    default:
      return sql`''`;
  }
}

export interface NameMaps {
  stages: Map<string, string>;
  pipelines: Map<string, string>;
  users: Map<string, string>;
  activityTypes: Map<string, string>;
}

export const EMPTY_NAME_MAPS: NameMaps = {
  stages: new Map(),
  pipelines: new Map(),
  users: new Map(),
  activityTypes: new Map(),
};

export interface NeededNames {
  stages: Set<string>;
  pipelines: Set<string>;
  users: Set<string>;
  activityTypes: Set<string>;
}

export function emptyNeededNames(): NeededNames {
  return {
    stages: new Set(),
    pipelines: new Set(),
    users: new Set(),
    activityTypes: new Set(),
  };
}

/** The label table a field resolves against, or null when the key is already its label. */
function nameBucket(field: string, needed: NeededNames): Set<string> | null {
  switch (field) {
    case "stage":
      return needed.stages;
    case "pipeline":
      return needed.pipelines;
    case "owner":
    case "assignee":
      return needed.users;
    case "activity_type":
      return needed.activityTypes;
    default:
      return null;
  }
}

export function collectNames(needed: NeededNames, field: string, key: string): void {
  const bucket = nameBucket(field, needed);
  if (bucket !== null && key !== "" && key !== "__other") bucket.add(key);
}

export async function loadNameMaps(
  db: Db,
  needed: NeededNames,
  signal: AbortSignal,
): Promise<NameMaps> {
  signal.throwIfAborted();
  const ids = (set: Set<string>): string[] => [...set];
  const [stageRows, pipelineRows, userRows, typeRows] = await Promise.all([
    needed.stages.size === 0
      ? []
      : db
          .select({ id: stages.id, name: stages.name })
          .from(stages)
          .where(inArray(stages.id, ids(needed.stages))),
    needed.pipelines.size === 0
      ? []
      : db
          .select({ id: pipelines.id, name: pipelines.name })
          .from(pipelines)
          .where(inArray(pipelines.id, ids(needed.pipelines))),
    needed.users.size === 0
      ? []
      : db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, ids(needed.users))),
    needed.activityTypes.size === 0
      ? []
      : db
          .select({ id: activityTypes.id, name: activityTypes.name })
          .from(activityTypes)
          .where(inArray(activityTypes.id, ids(needed.activityTypes))),
  ]);
  signal.throwIfAborted();
  const map = (rows: Array<{ id: string; name: string }>): Map<string, string> =>
    new Map(rows.map((row) => [row.id, row.name]));
  return {
    stages: map(stageRows),
    pipelines: map(pipelineRows),
    users: map(userRows),
    activityTypes: map(typeRows),
  };
}

function capitalise(key: string): string {
  return key.length === 0 ? key : `${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`;
}

export function labelFor(
  field: string,
  key: string,
  interval: Interval | undefined,
  maps: NameMaps,
): string {
  if (key === "__other") return S.other;
  if (key === "") return S.none;
  switch (field) {
    case "stage":
      return maps.stages.get(key) ?? key;
    case "pipeline":
      return maps.pipelines.get(key) ?? key;
    case "owner":
    case "assignee":
      return maps.users.get(key) ?? key;
    case "activity_type":
      return maps.activityTypes.get(key) ?? key;
    case "source_channel":
      return isSourceChannelKey(key) ? SOURCE_CHANNELS[key].name : key;
    case "created_at":
    case "won_at":
    case "lost_at":
    case "expected_close_date":
    case "due_at":
    case "done_at":
      return bucketLabel(key, interval ?? "month");
    case "status":
    case "done":
      return capitalise(key);
    default:
      return key;
  }
}

/** Resolve every row's group and segment label in memory, after the one batched lookup. */
export function applyLabels(
  result: ReportResult,
  def: ReportDefinition,
  maps: NameMaps,
): ReportResult {
  const groupField = def.groupBy?.field;
  const interval = def.groupBy?.interval;
  const segmentField = def.segmentBy?.field;
  const rows = result.rows.map((row) => ({
    ...row,
    gLabel: groupField === undefined ? "" : labelFor(groupField, row.g, interval, maps),
    sLabel:
      segmentField === undefined || row.s === null
        ? null
        : labelFor(segmentField, row.s, undefined, maps),
  }));
  return { ...result, rows };
}
