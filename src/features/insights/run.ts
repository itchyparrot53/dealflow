import { eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { REPORT_QUERY_TIMEOUT_MS } from "@/constants/insights";
import type { Db } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { loadRateMap } from "@/features/currency/rates";
import type { PermSetUser } from "@/features/permissions/effective";
import { isValidTimeZone } from "@/features/scheduling/zonedTime";
import { err, ok, type Result } from "@/types/result";
import { compileActivityReport } from "./compile/activities";
import { compileDealReport } from "./compile/deals";
import { applyLabels, collectNames, emptyNeededNames, loadNameMaps } from "./compile/shared";
import { convertRows, type RawReportRow } from "./convert";
import { resolveRange } from "./dateRange";
import { reportDefinitionSchema } from "./definition";
import { reportFunnel } from "./funnel";
import type { ReportResult } from "./result";

// The report engine entry point. One definition in, one grouped query, one conversion pass, one
// batched label lookup. Visibility is applied inside the query, never after it.

export interface RunReportOptions {
  /** Tests shorten the statement timeout; production uses REPORT_QUERY_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Tests pin "today"; everything else uses the request time. */
  now?: Date;
}

async function viewerTimeZone(db: Db, actor: PermSetUser, signal: AbortSignal): Promise<string> {
  const [row] = await db
    .select({ timezone: userPreferences.timezone })
    .from(userPreferences)
    .where(eq(userPreferences.userId, actor.id));
  signal.throwIfAborted();
  const tz = row?.timezone;
  return tz !== null && tz !== undefined && isValidTimeZone(tz) ? tz : "UTC";
}

function isStatementTimeout(error: unknown): boolean {
  const direct = (error as { code?: unknown }).code;
  const nested = (error as { cause?: { code?: unknown } }).cause?.code;
  return direct === "57014" || nested === "57014";
}

async function executeWithTimeout(
  db: Db,
  query: ReturnType<typeof sql>,
  timeoutMs: number,
): Promise<RawReportRow[]> {
  const result = await db.transaction(async (tx) => {
    // set_config accepts a bound parameter, unlike SET, and `true` makes it transaction-local.
    await tx.execute(sql`select set_config('statement_timeout', ${String(timeoutMs)}, true)`);
    return tx.execute(query);
  });
  return (result as unknown as { rows: RawReportRow[] }).rows;
}

export async function runReport(
  db: Db,
  actor: PermSetUser,
  definition: unknown,
  signal: AbortSignal,
  options: RunReportOptions = {},
): Promise<Result<ReportResult, AppError>> {
  const parsed = reportDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.INSIGHT_DEFINITION_INVALID, "invalid report definition", {
        issues: parsed.error.issues,
      }),
    );
  }
  const def = parsed.data;
  const now = options.now ?? new Date();
  const tz = await viewerTimeZone(db, actor, signal);
  const range = resolveRange(def.dateRange, now, tz);
  const opts = { tz, from: range.from, to: range.to };

  if (def.entity === "deal" && def.chart === "funnel") {
    return reportFunnel(db, actor, def, range, tz, now, signal);
  }

  const query =
    def.entity === "deal"
      ? compileDealReport(def, actor, opts)
      : compileActivityReport(def, actor, opts);
  const timeoutMs = options.timeoutMs ?? REPORT_QUERY_TIMEOUT_MS;
  let raw: RawReportRow[];
  try {
    raw = await executeWithTimeout(db, query, timeoutMs);
  } catch (error) {
    if (isStatementTimeout(error)) {
      return err(new AppError(ERROR_IDS.INSIGHT_QUERY_TIMEOUT, "report query timed out"));
    }
    throw error;
  }
  signal.throwIfAborted();

  const map = await loadRateMap(db, signal);
  const converted = convertRows(raw, def, map, { tz, from: range.from, to: range.to });

  const needed = emptyNeededNames();
  for (const row of converted.rows) {
    if (def.groupBy !== null) collectNames(needed, def.groupBy.field, row.g);
    if (def.segmentBy !== null && row.s !== null) collectNames(needed, def.segmentBy.field, row.s);
  }
  const names = await loadNameMaps(db, needed, signal);
  return ok(applyLabels(converted, def, names));
}
