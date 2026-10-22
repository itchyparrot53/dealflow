"use client";

import {
  ChartArea,
  ChartColumn,
  ChartLine,
  ChartPie,
  Filter,
  Gauge,
  Layers,
  Table2,
} from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Tip } from "@/components/ui/tooltip";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import {
  ACTIVITY_GROUP_FIELDS,
  ACTIVITY_SEGMENT_FIELDS,
  DATE_PRESETS,
  DEAL_GROUP_FIELDS,
  DEAL_SEGMENT_FIELDS,
  type DealReportDefinition,
  INTERVALS,
  type Interval,
  isActivityDateField,
  isDealDateField,
  type ReportDefinition,
} from "../definition";
import { chartDisabledReason, defaultDefinition } from "./builderState";
import { ReportFilterPanel } from "./ReportFilterPanel";

const S = INSIGHTS_STRINGS;

// The builder's left panel: entity, measure, grouping, segmentation, range, filter and chart.
// Every control is a shadcn wrapper; the chart picker explains each disabled option with a tip
// instead of silently greying it out.

type ChartKey = DealReportDefinition["chart"];

const CHART_META: Record<ChartKey, { label: string; Icon: typeof ChartColumn }> = {
  bar: { label: S.ui.chartBar, Icon: ChartColumn },
  stacked_bar: { label: S.ui.chartStackedBar, Icon: Layers },
  line: { label: S.ui.chartLine, Icon: ChartLine },
  area: { label: S.ui.chartArea, Icon: ChartArea },
  pie: { label: S.ui.chartPie, Icon: ChartPie },
  table: { label: S.ui.chartTable, Icon: Table2 },
  kpi: { label: S.ui.chartKpi, Icon: Gauge },
  funnel: { label: S.ui.chartFunnel, Icon: Filter },
};

const ALL_CHARTS: ChartKey[] = [
  "bar",
  "stacked_bar",
  "line",
  "area",
  "pie",
  "table",
  "kpi",
  "funnel",
];

function patch(def: ReportDefinition, values: Record<string, unknown>): ReportDefinition {
  return { ...def, ...values };
}

function fieldOptions(fields: readonly string[]): SelectOption[] {
  return fields.map((field) => ({
    value: field,
    label: (S.fields as Record<string, string>)[field] ?? field,
  }));
}

function measureOptions(def: ReportDefinition): SelectOption[] {
  if (def.entity === "activity") {
    return [
      { value: "count", label: S.ui.measureCount },
      { value: "sum_duration", label: S.ui.measureDuration },
    ];
  }
  return [
    { value: "count", label: S.ui.measureCount },
    { value: "sum_value", label: S.ui.measureSumValue },
    { value: "avg_value", label: S.ui.measureAvgValue },
    { value: "weighted_value", label: S.ui.measureWeighted },
  ];
}

interface Props {
  definition: ReportDefinition;
  onChange: (next: ReportDefinition) => void;
  pipelines: readonly { id: string; name: string; stages: { id: string; name: string }[] }[];
}

export function ReportConfigPanel({ definition, onChange, pipelines }: Props): React.ReactNode {
  const groupFields = definition.entity === "deal" ? DEAL_GROUP_FIELDS : ACTIVITY_GROUP_FIELDS;
  const segmentFields =
    definition.entity === "deal" ? DEAL_SEGMENT_FIELDS : ACTIVITY_SEGMENT_FIELDS;
  const stages = pipelines.flatMap((pipeline) =>
    pipeline.stages.map((stage) => ({ id: stage.id, name: stage.name })),
  );
  const dateField = definition.dateRange.field;
  const custom = definition.dateRange.preset === "custom";
  const group = definition.groupBy;

  function setEntity(value: string): void {
    if (value !== "deal" && value !== "activity") return;
    if (value === definition.entity) return;
    onChange(defaultDefinition(value));
  }

  function setGroup(value: string): void {
    if (value === "none") {
      onChange(patch(definition, { groupBy: null }));
      return;
    }
    const isDate =
      definition.entity === "deal" ? isDealDateField(value) : isActivityDateField(value);
    onChange(
      patch(definition, {
        groupBy: isDate ? { field: value, interval: "month" } : { field: value },
      }),
    );
  }

  function setInterval(value: string): void {
    if (group === null) return;
    onChange(patch(definition, { groupBy: { ...group, interval: value as Interval } }));
  }

  function setChart(chart: ChartKey): void {
    const next: Record<string, unknown> = { chart };
    if (
      chart === "funnel" &&
      definition.entity === "deal" &&
      definition.funnelPipelineId === undefined
    ) {
      const first = pipelines[0];
      if (first !== undefined) next.funnelPipelineId = first.id;
    }
    onChange(patch(definition, next));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-meta font-semibold text-muted-foreground">{S.ui.entity}</p>
        <Select
          ariaLabel={S.ui.entity}
          testId="report-entity"
          value={definition.entity}
          onChange={setEntity}
          options={[
            { value: "deal", label: S.ui.deals },
            { value: "activity", label: S.ui.activities },
          ]}
        />
      </div>

      <div className="space-y-1">
        <p className="text-meta font-semibold text-muted-foreground">{S.ui.measure}</p>
        <Select
          ariaLabel={S.ui.measure}
          testId="report-measure"
          value={definition.measure.kind}
          onChange={(value) => onChange(patch(definition, { measure: { kind: value } }))}
          options={measureOptions(definition)}
        />
      </div>

      <div className="space-y-1">
        <p className="text-meta font-semibold text-muted-foreground">{S.ui.groupBy}</p>
        <Select
          ariaLabel={S.ui.groupBy}
          testId="report-group-by"
          value={group?.field ?? "none"}
          onChange={setGroup}
          options={[{ value: "none", label: S.none }, ...fieldOptions(groupFields)]}
        />
        {group !== null &&
          (definition.entity === "deal"
            ? isDealDateField(group.field)
            : isActivityDateField(group.field)) && (
            <Select
              ariaLabel={S.ui.interval}
              testId="report-interval"
              value={group.interval ?? "month"}
              onChange={setInterval}
              options={INTERVALS.map((interval) => ({ value: interval, label: interval }))}
            />
          )}
      </div>

      <div className="space-y-1">
        <p className="text-meta font-semibold text-muted-foreground">{S.ui.segmentBy}</p>
        <Select
          ariaLabel={S.ui.segmentBy}
          testId="report-segment-by"
          value={definition.segmentBy?.field ?? "none"}
          onChange={(value) =>
            onChange(patch(definition, { segmentBy: value === "none" ? null : { field: value } }))
          }
          options={[{ value: "none", label: S.none }, ...fieldOptions(segmentFields)]}
        />
      </div>

      <div className="space-y-1">
        <p className="text-meta font-semibold text-muted-foreground">{S.ui.dateField}</p>
        <Select
          ariaLabel={S.ui.dateField}
          value={dateField}
          onChange={(value) =>
            onChange(
              patch(definition, {
                dateRange: { ...definition.dateRange, field: value },
              }),
            )
          }
          options={fieldOptions(
            definition.entity === "deal"
              ? ["created_at", "won_at", "lost_at", "expected_close_date"]
              : ["due_at", "created_at", "done_at"],
          )}
        />
        <Select
          ariaLabel={S.ui.dateRange}
          testId="report-date-preset"
          value={definition.dateRange.preset}
          onChange={(value) =>
            onChange(
              patch(definition, {
                dateRange: { ...definition.dateRange, preset: value },
              }),
            )
          }
          options={DATE_PRESETS.map((preset) => ({ value: preset, label: S.presets[preset] }))}
        />
        {custom && (
          <div className="flex items-center gap-2">
            <DatePicker
              ariaLabel={S.ui.dateFrom}
              value={definition.dateRange.from ?? null}
              onChange={(value) =>
                onChange(
                  patch(definition, {
                    dateRange: {
                      ...definition.dateRange,
                      preset: "custom",
                      from: value ?? undefined,
                    },
                  }),
                )
              }
            />
            <DatePicker
              ariaLabel={S.ui.dateTo}
              value={definition.dateRange.to ?? null}
              onChange={(value) =>
                onChange(
                  patch(definition, {
                    dateRange: {
                      ...definition.dateRange,
                      preset: "custom",
                      to: value ?? undefined,
                    },
                  }),
                )
              }
            />
          </div>
        )}
      </div>

      <ReportFilterPanel definition={definition} onChange={onChange} stages={stages} />

      <div className="space-y-1">
        <p className="text-meta font-semibold text-muted-foreground">{S.ui.chartType}</p>
        <fieldset
          aria-label={S.ui.chartType}
          data-testid="report-chart-type"
          className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0"
        >
          {ALL_CHARTS.filter((chart) => definition.entity === "deal" || chart !== "funnel").map(
            (chart) => {
              const meta = CHART_META[chart];
              const reason = chartDisabledReason(definition, chart);
              const active = definition.chart === chart;
              const button = (
                <Button
                  key={chart}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  aria-label={meta.label}
                  data-testid={`report-chart-type-${chart}`}
                  disabled={reason !== null}
                  onClick={() => setChart(chart)}
                >
                  <meta.Icon className="size-4" aria-hidden="true" />
                </Button>
              );
              return reason === null ? (
                button
              ) : (
                <Tip key={chart} label={reason}>
                  <span className="inline-flex">{button}</span>
                </Tip>
              );
            },
          )}
        </fieldset>
      </div>
    </div>
  );
}
