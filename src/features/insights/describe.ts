import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import {
  isActivityDateField,
  isDealDateField,
  type NameLookup,
  type ReportDefinition,
} from "./definition";

// One readable summary of a definition, shared by the reports list, the widget titles and the
// explain prompt. It reads the same labels the builder shows, so a report is named the same
// everywhere.

const S = INSIGHTS_STRINGS;

function fieldLabel(field: string): string {
  return (S.fields as Record<string, string>)[field] ?? field;
}

function measureLabel(def: ReportDefinition): string {
  if (def.entity === "activity") {
    return def.measure.kind === "count" ? S.measures.activities : S.measures.activityTime;
  }
  switch (def.measure.kind) {
    case "count":
      return S.measures.deals;
    case "avg_value":
      return S.measures.avgValue;
    case "weighted_value":
      return S.measures.weightedValue;
    case "sum_value":
      switch (def.dateRange.field) {
        case "won_at":
          return S.measures.wonValue;
        case "lost_at":
          return S.measures.lostValue;
        case "expected_close_date":
          return S.measures.expectedValue;
        case "created_at":
          return S.measures.createdValue;
      }
  }
}

function groupPhrase(def: ReportDefinition): string | null {
  const group = def.groupBy;
  if (group === null) return null;
  const interval = group.interval ?? "month";
  const isDate =
    def.entity === "deal" ? isDealDateField(group.field) : isActivityDateField(group.field);
  const unit = isDate ? S.intervals[interval] : fieldLabel(group.field);
  return `${S.describe.by} ${unit}`;
}

export function describeDefinition(def: ReportDefinition, names: NameLookup): string {
  const range = S.presets[def.dateRange.preset];
  if (def.chart === "funnel") {
    const pipeline = names.pipelineName?.(def.funnelPipelineId ?? "") ?? S.describe.unknownPipeline;
    return `${S.describe.funnel} for ${pipeline}, ${range}`;
  }
  const parts = [measureLabel(def)];
  const group = groupPhrase(def);
  if (group !== null) parts.push(group);
  if (def.segmentBy !== null)
    parts.push(`${S.describe.splitBy} ${fieldLabel(def.segmentBy.field)}`);
  return `${parts.join(" ")}, ${range}`;
}
