import { csvLine } from "@/features/export/csv";
import type { ReportDefinition } from "./definition";
import type { ReportResult } from "./result";

// The shared RFC 4180 writer in src/features/export/csv.ts owns quoting and the formula guard;
// this module only chooses the report's columns and their header labels. That guard matters
// because group and segment labels are user-controlled (stage, label and owner names).

function valueHeader(def: ReportDefinition, result: ReportResult): string {
  if (def.entity === "activity" && def.measure.kind === "sum_duration") return "Value (minutes)";
  if (def.measure.kind === "count") return "Value";
  return `Value (${result.baseCurrency})`;
}

export function toCsv(result: ReportResult, def: ReportDefinition): string {
  const lines: (string | number | null)[][] = [
    ["Group", "Segment", "Count", valueHeader(def, result)],
    ...result.rows.map((row) => [row.gLabel, row.sLabel ?? "", String(row.count), row.value]),
  ];
  return lines.map((line) => csvLine(line)).join("");
}
