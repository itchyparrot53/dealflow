import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { readBaseCurrency } from "@/features/currency/rates";
import type { PermSetUser } from "@/features/permissions/effective";
import { EVERYONE } from "@/features/stats/ownerIds";
import { stageConversion } from "@/features/stats/stageConversion";
import { err, ok, type Result } from "@/types/result";
import { localDateKey } from "./dateRange";
import type { DealReportDefinition } from "./definition";
import type { FunnelStage, ReportResult } from "./result";

// The funnel is warpdrive's own stage-conversion cohort, reused rather than reimplemented: the
// existing stats query windows on deals created in the range and counts how far each got, with
// the deals visibility predicate inside it. An all-time report widens the cohort to every deal.

export async function reportFunnel(
  db: Db,
  actor: PermSetUser,
  def: DealReportDefinition,
  range: { from: Date | null; to: Date | null },
  tz: string,
  now: Date,
  signal: AbortSignal,
): Promise<Result<ReportResult, AppError>> {
  const pipelineId = def.funnelPipelineId;
  if (pipelineId === undefined) {
    return err(
      new AppError(ERROR_IDS.INSIGHT_DEFINITION_INVALID, "a funnel needs a pipeline", {
        chart: def.chart,
      }),
    );
  }

  const fromDate = range.from === null ? "1970-01-01" : localDateKey(range.from, tz);
  // The range is half-open, but stageConversion takes an inclusive end date, so use the last day.
  const toDate =
    range.to === null ? localDateKey(now, tz) : localDateKey(new Date(range.to.getTime() - 1), tz);

  const stages = await stageConversion(
    db,
    actor,
    { pipelineId, owners: EVERYONE, from: fromDate, to: toDate },
    signal,
  );
  signal.throwIfAborted();

  const funnel: FunnelStage[] = stages.map((stage) => ({
    stageId: stage.stageId,
    name: stage.name,
    order: stage.order,
    reached: stage.reached,
    conversion: stage.conversion,
    medianDaysInStage: stage.medianDaysInStage,
  }));
  const first = stages[0];
  const baseCurrency = await readBaseCurrency(db, signal);

  return ok({
    baseCurrency,
    measure: "count",
    rows: stages.map((stage) => ({
      g: stage.stageId,
      gLabel: stage.name,
      s: null,
      sLabel: null,
      value: String(stage.reached),
      count: stage.reached,
    })),
    total: { value: String(first?.reached ?? 0), count: first?.reached ?? 0 },
    excluded: [],
    truncated: false,
    generatedAt: new Date().toISOString(),
    funnel,
  });
}
