import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import {
  type DealReportDefinition,
  isActivityDateField,
  isDealDateField,
  type ReportDefinition,
} from "../definition";

// Pure builder state helpers: the defaults for each entity and the 6.5 chart rules as disabled
// reasons, so the picker explains exactly why an option is unavailable.

const S = INSIGHTS_STRINGS;

export function defaultDefinition(entity: "deal" | "activity"): ReportDefinition {
  if (entity === "deal") {
    return {
      entity: "deal",
      measure: { kind: "count" },
      groupBy: null,
      segmentBy: null,
      dateRange: { field: "created_at", preset: "all_time" },
      filter: null,
      chart: "bar",
    };
  }
  return {
    entity: "activity",
    measure: { kind: "count" },
    groupBy: null,
    segmentBy: null,
    dateRange: { field: "due_at", preset: "all_time" },
    filter: null,
    chart: "bar",
  };
}

export function isDateGroup(def: ReportDefinition): boolean {
  const group = def.groupBy;
  if (group === null) return false;
  return def.entity === "deal" ? isDealDateField(group.field) : isActivityDateField(group.field);
}

export function chartDisabledReason(
  def: ReportDefinition,
  chart: DealReportDefinition["chart"] | "bar",
): string | null {
  const hasGroup = def.groupBy !== null;
  const dateGroup = isDateGroup(def);
  const hasSegment = def.segmentBy !== null;
  switch (chart) {
    case "pie":
      return !hasGroup || dateGroup || hasSegment ? S.ui.disabledPie : null;
    case "kpi":
      return hasGroup || hasSegment ? S.ui.disabledKpi : null;
    case "stacked_bar":
      return hasSegment ? null : S.ui.disabledStacked;
    case "line":
    case "area":
      return dateGroup ? null : S.ui.disabledLine;
    case "funnel":
      return def.entity === "deal" ? null : S.ui.disabledFunnel;
    case "bar":
    case "table":
      return null;
  }
}

export function withChart(
  def: ReportDefinition,
  chart: DealReportDefinition["chart"],
): ReportDefinition {
  if (def.entity === "activity") {
    // The activity chart union has no funnel.
    return { ...def, chart: chart === "funnel" ? "bar" : chart };
  }
  return { ...def, chart };
}
