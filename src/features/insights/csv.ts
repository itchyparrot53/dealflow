import type { ReportDefinition } from "./definition";
import type { ReportResult } from "./result";

// RFC 4180 CSV for a report result. Every cell is quoted, lines end in CRLF, and a cell that a
// spreadsheet could execute as a formula gets a leading apostrophe. That guard matters because
// group and segment labels are user-controlled (stage, label and owner names).

const FORMULA_LEADERS: readonly string[] = ["=", "+", "-", "@", "\t", "\r"];

function cell(raw: string): string {
  const guarded = FORMULA_LEADERS.some((leader) => raw.startsWith(leader)) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function valueHeader(def: ReportDefinition, result: ReportResult): string {
  if (def.entity === "activity" && def.measure.kind === "sum_duration") return "Value (minutes)";
  if (def.measure.kind === "count") return "Value";
  return `Value (${result.baseCurrency})`;
}

export function toCsv(result: ReportResult, def: ReportDefinition): string {
  const lines: string[][] = [
    ["Group", "Segment", "Count", valueHeader(def, result)],
    ...result.rows.map((row) => [row.gLabel, row.sLabel ?? "", String(row.count), row.value]),
  ];
  return `${lines.map((line) => line.map(cell).join(",")).join("\r\n")}\r\n`;
}
