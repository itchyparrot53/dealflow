import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import type { ReportDefinition } from "./definition";
import type { ReportResult, ReportRow } from "./result";

function row(over: Partial<ReportRow> = {}): ReportRow {
  return {
    g: "stage-1",
    gLabel: "Lead",
    s: null,
    sLabel: null,
    value: "3",
    count: 3,
    ...over,
  };
}

function result(over: Partial<ReportResult> = {}): ReportResult {
  return {
    baseCurrency: "USD",
    measure: "count",
    rows: [row()],
    total: { value: "3", count: 3 },
    excluded: [],
    truncated: false,
    generatedAt: "2026-10-21T10:00:00.000Z",
    ...over,
  };
}

const countDef = {
  entity: "deal",
  measure: { kind: "count" },
  groupBy: { field: "stage" },
  segmentBy: null,
  dateRange: { field: "created_at", preset: "this_year" },
  filter: null,
  chart: "bar",
} as ReportDefinition;

const valueDef = {
  ...countDef,
  measure: { kind: "sum_value" },
} as ReportDefinition;

const durationDef = {
  entity: "activity",
  measure: { kind: "sum_duration" },
  groupBy: null,
  segmentBy: null,
  dateRange: { field: "due_at", preset: "this_month" },
  filter: null,
  chart: "table",
} as ReportDefinition;

describe("toCsv", () => {
  it("writes the header and CRLF lines for a count report", () => {
    expect(toCsv(result(), countDef)).toBe("Group,Segment,Count,Value\r\nLead,,3,3\r\n");
  });

  it("labels the value column with the base currency or the duration unit", () => {
    const money = result({ measure: "sum_value", rows: [row({ value: "1500.00", count: 2 })] });
    expect(toCsv(money, valueDef).split("\r\n")[0]).toBe("Group,Segment,Count,Value (USD)");
    const duration = result({ measure: "sum_duration", rows: [row({ value: "90", count: 2 })] });
    expect(toCsv(duration, durationDef).split("\r\n")[0]).toBe(
      "Group,Segment,Count,Value (minutes)",
    );
  });

  it("writes the segment label when there is one", () => {
    const csv = toCsv(result({ rows: [row({ s: "open", sLabel: "Open" })] }), countDef);
    expect(csv).toContain("Lead,Open,3,3");
  });

  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv(
      result({
        rows: [row({ gLabel: 'Acme, Inc. "North"' }), row({ gLabel: "line one\nline two" })],
      }),
      countDef,
    );
    expect(csv).toContain('"Acme, Inc. ""North"""');
    expect(csv).toContain('"line one\nline two"');
  });

  it("prefixes a formula-injection guard on every dangerous first character", () => {
    const cases: [string, string][] = [
      ["=SUM(A1)", "'=SUM(A1)"],
      ["+1", "'+1"],
      ["-1", "'-1"],
      ["@x", "'@x"],
      ["\tcell", "'\tcell"],
      // A carriage return also forces RFC 4180 quoting, so the guard sits inside the quotes.
      ["\rcell", '"\'\rcell"'],
    ];
    const csv = toCsv(result({ rows: cases.map(([gLabel]) => row({ gLabel })) }), countDef);
    for (const [, expected] of cases) {
      expect(csv).toContain(expected);
    }
  });

  it("writes only the header for an empty report", () => {
    expect(toCsv(result({ rows: [] }), countDef)).toBe("Group,Segment,Count,Value\r\n");
  });

  it("quotes a null segment as an empty cell", () => {
    expect(toCsv(result(), countDef)).toContain("Lead,,3,3");
  });
});
