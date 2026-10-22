import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import type { ReportDefinition } from "../definition";
import type { ReportResult } from "../result";
import { formatReportValue } from "./format";

const S = INSIGHTS_STRINGS;

// The accessible, exact view of every report: the chart restates it, and a report with
// chart = "table" is this alone.

export function ReportTable({
  result,
  definition,
}: {
  result: ReportResult;
  definition: ReportDefinition;
}): React.ReactNode {
  const hasSegment = definition.segmentBy !== null;
  return (
    <div data-testid="report-table" className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-meta font-semibold text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {S.ui.group}
            </th>
            {hasSegment && (
              <th scope="col" className="px-3 py-2 font-medium">
                {S.ui.segment}
              </th>
            )}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {S.ui.count}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {S.ui.value}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <tr>
              <td
                colSpan={hasSegment ? 4 : 3}
                className="px-3 py-4 text-center text-muted-foreground"
              >
                {S.none}
              </td>
            </tr>
          ) : (
            result.rows.map((row) => (
              <tr key={`${row.g}:${row.s ?? ""}`} className="border-t">
                <td className="px-3 py-1.5">{row.gLabel === "" ? S.none : row.gLabel}</td>
                {hasSegment && <td className="px-3 py-1.5">{row.sLabel ?? S.none}</td>}
                <td className="px-3 py-1.5 text-right tabular-nums">{row.count}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatReportValue(row.value, definition, result.baseCurrency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
