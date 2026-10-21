import { formatMoney, parseCents } from "@/features/currency/money";
import type { ReportDefinition } from "../definition";

// One place that turns a result's decimal string into what a reader sees, so the chart tooltip,
// the table and the KPI tile never disagree about money vs counts vs minutes.

export function formatReportValue(
  value: string,
  definition: ReportDefinition,
  baseCurrency: string,
): string {
  const kind = definition.measure.kind;
  if (kind === "count") return value;
  if (kind === "sum_duration") return `${value} min`;
  return formatMoney(parseCents(value), baseCurrency);
}

export function numericValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
