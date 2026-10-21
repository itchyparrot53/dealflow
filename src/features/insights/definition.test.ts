import { describe, expect, it } from "vitest";
import {
  type DealReportDefinition,
  describeDefinition,
  type ReportDefinition,
  reportDefinitionSchema,
} from "./definition";

const PIPELINE_ID = "0f5b6c9e-3a51-4c1b-9d1f-2a3b4c5d6e7f";

function deal(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    entity: "deal",
    measure: { kind: "count" },
    groupBy: null,
    segmentBy: null,
    dateRange: { field: "created_at", preset: "this_year" },
    filter: null,
    chart: "bar",
    ...over,
  };
}

function activity(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    entity: "activity",
    measure: { kind: "count" },
    groupBy: null,
    segmentBy: null,
    dateRange: { field: "due_at", preset: "this_month" },
    filter: null,
    chart: "bar",
    ...over,
  };
}

function accepted(input: unknown): boolean {
  return reportDefinitionSchema.safeParse(input).success;
}

describe("report definition: chart rules", () => {
  it("accepts a plain bar report and a table report", () => {
    expect(accepted(deal({ groupBy: { field: "stage" }, chart: "bar" }))).toBe(true);
    expect(accepted(deal({ groupBy: { field: "stage" }, chart: "table" }))).toBe(true);
  });

  it("accepts a pie over a non-date group with no segment", () => {
    expect(accepted(deal({ groupBy: { field: "stage" }, chart: "pie" }))).toBe(true);
    expect(accepted(activity({ groupBy: { field: "activity_type" }, chart: "pie" }))).toBe(true);
  });

  it("refuses a pie over a date group or with a segment", () => {
    expect(accepted(deal({ groupBy: { field: "won_at", interval: "month" }, chart: "pie" }))).toBe(
      false,
    );
    expect(
      accepted(deal({ groupBy: { field: "stage" }, segmentBy: { field: "status" }, chart: "pie" })),
    ).toBe(false);
  });

  it("accepts a kpi with no group and no segment", () => {
    expect(accepted(deal({ chart: "kpi" }))).toBe(true);
    expect(accepted(activity({ chart: "kpi" }))).toBe(true);
  });

  it("refuses a kpi with a group or a segment", () => {
    expect(accepted(deal({ groupBy: { field: "stage" }, chart: "kpi" }))).toBe(false);
    expect(accepted(deal({ segmentBy: { field: "status" }, chart: "kpi" }))).toBe(false);
  });

  it("requires a segment for stacked bars", () => {
    expect(accepted(deal({ groupBy: { field: "stage" }, chart: "stacked_bar" }))).toBe(false);
    expect(
      accepted(
        deal({ groupBy: { field: "stage" }, segmentBy: { field: "status" }, chart: "stacked_bar" }),
      ),
    ).toBe(true);
    expect(
      accepted(
        activity({
          groupBy: { field: "owner" },
          segmentBy: { field: "done" },
          chart: "stacked_bar",
        }),
      ),
    ).toBe(true);
  });

  it("requires a date group for line and area", () => {
    expect(accepted(deal({ groupBy: { field: "stage" }, chart: "line" }))).toBe(false);
    expect(accepted(deal({ groupBy: null, chart: "area" }))).toBe(false);
    expect(accepted(deal({ groupBy: { field: "won_at", interval: "month" }, chart: "line" }))).toBe(
      true,
    );
    expect(
      accepted(activity({ groupBy: { field: "due_at", interval: "week" }, chart: "area" })),
    ).toBe(true);
  });

  it("refuses a date group without an interval and an interval on a plain group", () => {
    expect(accepted(deal({ groupBy: { field: "won_at" } }))).toBe(false);
    expect(accepted(deal({ groupBy: { field: "stage", interval: "month" } }))).toBe(false);
    expect(accepted(deal({ groupBy: { field: "won_at", interval: "decade" } }))).toBe(false);
  });

  it("refuses a segment on a date field", () => {
    expect(accepted(deal({ segmentBy: { field: "won_at" } }))).toBe(false);
    expect(accepted(activity({ segmentBy: { field: "due_at" } }))).toBe(false);
  });

  it("takes a funnel only for deals, with a pipeline, ignoring group and segment", () => {
    expect(accepted(deal({ chart: "funnel" }))).toBe(false);
    expect(accepted(deal({ chart: "funnel", funnelPipelineId: PIPELINE_ID }))).toBe(true);
    expect(
      accepted(
        deal({ chart: "funnel", funnelPipelineId: PIPELINE_ID, groupBy: { field: "stage" } }),
      ),
    ).toBe(true);
    expect(accepted(activity({ chart: "funnel", funnelPipelineId: PIPELINE_ID }))).toBe(false);
  });

  it("refuses unknown entities, charts, fields and measures", () => {
    expect(accepted(deal({ entity: "person" }))).toBe(false);
    expect(accepted(deal({ chart: "scatter" }))).toBe(false);
    expect(accepted(deal({ groupBy: { field: "due_at", interval: "week" } }))).toBe(false);
    expect(accepted(deal({ measure: { kind: "sum_duration" } }))).toBe(false);
    expect(accepted(activity({ measure: { kind: "sum_value" } }))).toBe(false);
    expect(accepted(activity({ groupBy: { field: "stage" } }))).toBe(false);
  });
});

describe("report definition: custom date range", () => {
  it("accepts custom only with both bounds in order", () => {
    expect(
      accepted(
        deal({
          dateRange: { field: "won_at", preset: "custom", from: "2026-01-01", to: "2026-03-31" },
        }),
      ),
    ).toBe(true);
    expect(
      accepted(deal({ dateRange: { field: "won_at", preset: "custom", from: "2026-01-01" } })),
    ).toBe(false);
    expect(
      accepted(deal({ dateRange: { field: "won_at", preset: "custom", to: "2026-03-31" } })),
    ).toBe(false);
    expect(
      accepted(
        deal({
          dateRange: { field: "won_at", preset: "custom", from: "2026-03-31", to: "2026-01-01" },
        }),
      ),
    ).toBe(false);
  });

  it("refuses a malformed or impossible date", () => {
    expect(
      accepted(
        deal({
          dateRange: { field: "won_at", preset: "custom", from: "01/01/2026", to: "2026-02-01" },
        }),
      ),
    ).toBe(false);
    expect(
      accepted(
        deal({
          dateRange: { field: "won_at", preset: "custom", from: "2026-02-31", to: "2026-03-01" },
        }),
      ),
    ).toBe(false);
  });

  it("refuses a range longer than three years, and allows exactly three", () => {
    expect(
      accepted(
        deal({
          dateRange: { field: "won_at", preset: "custom", from: "2020-01-01", to: "2023-01-01" },
        }),
      ),
    ).toBe(true);
    expect(
      accepted(
        deal({
          dateRange: { field: "won_at", preset: "custom", from: "2020-01-01", to: "2023-01-02" },
        }),
      ),
    ).toBe(false);
  });
});

describe("report definition: filters", () => {
  it("accepts the saved-filter deal AST and the activity filter", () => {
    expect(
      accepted(
        deal({
          filter: { combinator: "and", conditions: [{ field: "status", op: "eq", value: "open" }] },
        }),
      ),
    ).toBe(true);
    expect(accepted(activity({ filter: { ownerIds: [PIPELINE_ID], done: false } }))).toBe(true);
  });

  it("refuses a deal filter using an activity-only or unknown field", () => {
    expect(
      accepted(
        deal({
          filter: { combinator: "and", conditions: [{ field: "due_at", op: "is", value: "x" }] },
        }),
      ),
    ).toBe(false);
  });
});

describe("describeDefinition", () => {
  const names = { pipelineName: (id: string) => (id === PIPELINE_ID ? "Sales" : null) };

  it("names the measure, group and range", () => {
    const def = deal({
      measure: { kind: "sum_value" },
      groupBy: { field: "won_at", interval: "month" },
      dateRange: { field: "won_at", preset: "this_year" },
    }) as unknown as ReportDefinition;
    expect(describeDefinition(def, names)).toBe("Won value by month, this year");
  });

  it("names a segment and a kpi", () => {
    const segmented = deal({
      groupBy: { field: "stage" },
      segmentBy: { field: "status" },
      chart: "stacked_bar",
    }) as unknown as ReportDefinition;
    expect(describeDefinition(segmented, names)).toBe("Deals by stage split by status, this year");

    const kpi = deal({
      measure: { kind: "sum_value" },
      chart: "kpi",
    }) as unknown as ReportDefinition;
    expect(describeDefinition(kpi, names)).toBe("Created value, this year");
  });

  it("names the funnel pipeline, falling back when it is unknown", () => {
    const funnel = deal({
      chart: "funnel",
      funnelPipelineId: PIPELINE_ID,
    }) as unknown as DealReportDefinition;
    expect(describeDefinition(funnel, names)).toBe("Win/loss funnel for Sales, this year");
    const unknown = deal({
      chart: "funnel",
      funnelPipelineId: "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    }) as unknown as DealReportDefinition;
    expect(describeDefinition(unknown, names)).toBe("Win/loss funnel for pipeline, this year");
  });
});
