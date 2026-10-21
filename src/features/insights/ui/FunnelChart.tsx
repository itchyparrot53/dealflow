import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import type { ReportResult } from "../result";

const S = INSIGHTS_STRINGS;

// Horizontal funnel by stage with the conversion from the first stage, then the step-to-step
// percentage between neighbouring stages. Reuses the stats stage conversion output.

export function FunnelChart({ result }: { result: ReportResult }): React.ReactNode {
  const stages = result.funnel ?? [];
  if (stages.length === 0) {
    return <p className="text-sm text-muted-foreground">{S.none}</p>;
  }
  const max = Math.max(1, stages[0]?.reached ?? 0);
  return (
    <div className="space-y-2">
      {stages.map((stage, index) => {
        const previous = index === 0 ? null : (stages[index - 1] ?? null);
        const step =
          previous === null || previous.reached === 0
            ? null
            : Math.round((stage.reached / previous.reached) * 100);
        return (
          <div key={stage.stageId} data-testid="funnel-stage">
            <div className="mb-0.5 flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{stage.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {stage.reached} · {Math.round(stage.conversion * 100)}%
                {step === null ? "" : ` · ${step}% step`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={stage.name}
              aria-valuenow={stage.reached}
              aria-valuemin={0}
              aria-valuemax={max}
              className="h-2 w-full overflow-hidden rounded bg-muted"
            >
              <div
                className="h-full rounded bg-primary"
                style={{ width: `${Math.round((stage.reached / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
