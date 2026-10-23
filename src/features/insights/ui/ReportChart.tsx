"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import {
  currencyMinorDigits,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
} from "@/lib/format/number";
import type { ReportDefinition } from "../definition";
import type { ReportResult } from "../result";
import { FunnelChart } from "./FunnelChart";
import { numericValue } from "./format";
import { KpiTile } from "./KpiTile";
import { ReportTable } from "./ReportTable";

const S = INSIGHTS_STRINGS;

// Series colours are tokens published by the chart wrapper. A segment takes the next token; the
// palette repeats once a report has more segments than tokens, which is still readable because the
// table beside the chart carries every label.

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function seriesData(
  result: ReportResult,
  def: ReportDefinition,
): {
  names: string[];
  data: Array<Record<string, string | number>>;
  config: ChartConfig;
} {
  const hasSegments = def.segmentBy !== null && result.rows.some((row) => row.sLabel !== null);
  const names = hasSegments
    ? unique(
        result.rows.map((row) => row.sLabel).filter((label): label is string => label !== null),
      )
    : [S.ui.value];
  const keyOf = (name: string): string => `s${Math.max(0, names.indexOf(name))}`;
  const config: ChartConfig = Object.fromEntries(
    names.map((name, index) => [
      keyOf(name),
      { label: name, color: PALETTE[index % PALETTE.length] },
    ]),
  );
  const labels = unique(result.rows.map((row) => row.gLabel));
  const data = labels.map((label) => {
    const point: Record<string, string | number> = { label };
    for (const row of result.rows) {
      if (row.gLabel !== label) continue;
      point[keyOf(row.sLabel ?? S.ui.value)] = numericValue(row.value);
    }
    return point;
  });
  return { names, data, config };
}

function pieData(result: ReportResult): {
  data: Array<{ label: string; value: number }>;
  config: ChartConfig;
} {
  const totals = new Map<string, number>();
  for (const row of result.rows) {
    totals.set(row.gLabel, (totals.get(row.gLabel) ?? 0) + numericValue(row.value));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8);
  const data = top.map(([label, value]) => ({ label: label === "" ? S.none : label, value }));
  if (rest.length > 0) {
    data.push({ label: S.other, value: rest.reduce((sum, [, value]) => sum + value, 0) });
  }
  const config: ChartConfig = Object.fromEntries(
    data.map((entry, index) => [
      `p${index}`,
      { label: entry.label, color: PALETTE[index % PALETTE.length] },
    ]),
  );
  return { data, config };
}

// Money is shown the way the table shows it: formatMoney in the report's base currency. Counts
// and minutes stay plain numbers.
function chartValue(
  value: string | number | undefined,
  definition: ReportDefinition,
  baseCurrency: string,
  mode: "axis" | "tooltip" = "tooltip",
): string {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(number)) return "0";
  const kind = definition.measure.kind;
  if (kind === "count") {
    return formatNumber(number);
  }
  if (kind === "sum_duration") {
    return `${formatNumber(number)} min`;
  }
  const minor = Math.round(number * 10 ** currencyMinorDigits(baseCurrency));
  return mode === "axis"
    ? formatMoneyCompact(minor, baseCurrency)
    : formatMoney(minor, baseCurrency);
}

export function ReportChart({
  result,
  definition,
  description,
}: {
  result: ReportResult;
  definition: ReportDefinition;
  description: string;
}): React.ReactNode {
  if (definition.chart === "table") {
    return <ReportTable result={result} definition={definition} />;
  }
  if (definition.chart === "kpi") {
    return <KpiTile result={result} definition={definition} description={description} />;
  }
  if (definition.chart === "funnel") {
    return <FunnelChart result={result} />;
  }
  if (result.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{S.none}</p>;
  }

  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={8} />
      <YAxis
        width={96}
        tickLine={false}
        axisLine={false}
        tickFormatter={(value: number) =>
          chartValue(value, definition, result.baseCurrency, "axis")
        }
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatValue={(value) => chartValue(value, definition, result.baseCurrency)}
          />
        }
      />
    </>
  );

  if (definition.chart === "pie") {
    const pie = pieData(result);
    return (
      <ChartContainer config={pie.config} className="h-72">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatValue={(value) => chartValue(value, definition, result.baseCurrency)}
              />
            }
          />
          <Pie data={pie.data} dataKey="value" nameKey="label" outerRadius={100}>
            {pie.data.map((entry, index) => (
              <Cell key={entry.label} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    );
  }

  const { names, data, config } = seriesData(result, definition);

  if (definition.chart === "line" || definition.chart === "area") {
    const Chart = definition.chart === "line" ? LineChart : AreaChart;
    return (
      <ChartContainer config={config} className="h-72">
        <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {axes}
          {names.map((name) => {
            const key = `s${names.indexOf(name)}`;
            const color = `var(--color-${key})`;
            return definition.chart === "line" ? (
              <Line
                key={key}
                type="linear"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            ) : (
              <Area
                key={key}
                type="linear"
                dataKey={key}
                stroke={color}
                fill={color}
                fillOpacity={0.2}
              />
            );
          })}
        </Chart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={config} className="h-72">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {axes}
        {names.map((name) => {
          const key = `s${names.indexOf(name)}`;
          return (
            <Bar
              key={key}
              dataKey={key}
              stackId={definition.chart === "stacked_bar" ? "stack" : undefined}
              fill={`var(--color-${key})`}
              radius={[3, 3, 0, 0]}
            />
          );
        })}
      </BarChart>
    </ChartContainer>
  );
}
