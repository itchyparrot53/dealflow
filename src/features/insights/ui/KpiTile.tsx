import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import type { ReportDefinition } from "../definition";
import type { ReportResult } from "../result";
import { formatReportValue } from "./format";

const S = INSIGHTS_STRINGS;

// A single number with its context: the big value, how many records it covers, and the range
// label the definition describes.

export function KpiTile({
  result,
  definition,
  description,
}: {
  result: ReportResult;
  definition: ReportDefinition;
  description: string;
}): React.ReactNode {
  const noun = definition.entity === "deal" ? S.ui.deals : S.ui.activities;
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-title font-semibold tabular">
        {formatReportValue(result.total.value, definition, result.baseCurrency)}
      </p>
      <p className="mt-1 text-meta text-muted-foreground">
        {result.total.count} {noun} · {description}
      </p>
    </div>
  );
}
