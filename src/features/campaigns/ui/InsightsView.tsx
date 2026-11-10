"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Select } from "@/components/ui/Select";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPES, type CampaignType } from "@/constants/campaigns";
import { formatNumber } from "@/lib/format/number";
import { trpc } from "@/lib/trpc-client";
import {
  type CampaignMetricRow,
  compareToAverage,
  type InsightRates,
  type SequenceMetricRow,
  type SequenceStepMetricRow,
} from "../insightsShared";

// 6.11's "premium" view: the campaigns in a date range beside their own average, plus the same
// metrics per sequence and per step. Everything is client-side sorting/filtering over the one
// server aggregate, so changing a filter refetches once and not per row.

const CHART_CONFIG: ChartConfig = {
  opens: { label: "Open rate", color: "hsl(var(--chart-1))" },
  clicks: { label: "Click rate", color: "hsl(var(--chart-2))" },
};

const DAY_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 365 days" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  ...CAMPAIGN_TYPES.map((type) => ({ value: type, label: CAMPAIGN_TYPE_LABELS[type] })),
];

type SortKey =
  | "name"
  | "type"
  | "senderName"
  | "recipients"
  | "openRate"
  | "clickRate"
  | "ctor"
  | "unsubscribeRate"
  | "bounceRate";

const COLUMNS: { key: SortKey; label: string; rate: boolean }[] = [
  { key: "name", label: "Campaign", rate: false },
  { key: "type", label: "Type", rate: false },
  { key: "senderName", label: "Sender", rate: false },
  { key: "recipients", label: "Recipients", rate: false },
  { key: "openRate", label: "Open", rate: true },
  { key: "clickRate", label: "Click", rate: true },
  { key: "ctor", label: "CTOR", rate: true },
  { key: "unsubscribeRate", label: "Unsub", rate: true },
  { key: "bounceRate", label: "Bounce", rate: true },
];

function pct(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function typeLabel(type: string): string {
  return (CAMPAIGN_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

function RateCell({
  value,
  average,
}: {
  value: number | null;
  average: number | null;
}): React.ReactNode {
  const arrow = compareToAverage(value, average);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {pct(value)}
      {arrow === null ? null : (
        <span className={arrow === "up" ? "text-success" : "text-destructive"}>
          {arrow === "up" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          <span className="sr-only">{arrow === "up" ? "Above average" : "Below average"}</span>
        </span>
      )}
    </span>
  );
}

function sortValue(row: CampaignMetricRow, key: SortKey): string | number {
  if (key === "name" || key === "type" || key === "senderName") {
    return row[key] ?? "";
  }
  if (key === "recipients") return row.recipients;
  return row[key] ?? -1;
}

function sortedCampaigns(
  rows: readonly CampaignMetricRow[],
  key: SortKey,
  direction: "asc" | "desc",
): CampaignMetricRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (typeof left === "string" || typeof right === "string") {
      return String(left).localeCompare(String(right)) * factor;
    }
    return (left - right) * factor;
  });
}

function AverageRateCells({ average }: { average: InsightRates }): React.ReactNode {
  return (
    <>
      <td className="px-3 py-2 tabular-nums">{pct(average.openRate)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(average.clickRate)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(average.ctor)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(average.unsubscribeRate)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(average.bounceRate)}</td>
    </>
  );
}

function SequenceRates({
  row,
  average,
}: {
  row: SequenceMetricRow;
  average: InsightRates;
}): React.ReactNode {
  return (
    <>
      <td className="px-3 py-2 tabular-nums">
        <RateCell value={row.openRate} average={average.openRate} />
      </td>
      <td className="px-3 py-2 tabular-nums">
        <RateCell value={row.clickRate} average={average.clickRate} />
      </td>
      <td className="px-3 py-2 tabular-nums">
        <RateCell value={row.ctor} average={average.ctor} />
      </td>
      <td className="px-3 py-2 tabular-nums">
        <RateCell value={row.unsubscribeRate} average={average.unsubscribeRate} />
      </td>
      <td className="px-3 py-2 tabular-nums">
        <RateCell value={row.bounceRate} average={average.bounceRate} />
      </td>
    </>
  );
}

function StepRates({ row }: { row: SequenceStepMetricRow }): React.ReactNode {
  return (
    <>
      <td className="px-3 py-2 tabular-nums">{pct(row.openRate)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(row.clickRate)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(row.ctor)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(row.unsubscribeRate)}</td>
      <td className="px-3 py-2 tabular-nums">{pct(row.bounceRate)}</td>
    </>
  );
}

function TrendChart({ campaigns }: { campaigns: readonly CampaignMetricRow[] }): React.ReactNode {
  const data = [...campaigns]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((campaign) => ({
      label: campaign.startedAt,
      opens: campaign.openRate ?? 0,
      clicks: campaign.clickRate ?? 0,
    }));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No sent campaigns in this range.</p>;
  }
  return (
    <ChartContainer config={CHART_CONFIG} className="h-72">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          tickFormatter={(value: string) =>
            new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          }
        />
        <YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatValue={(value) => `${(Number(value ?? 0) * 100).toFixed(1)}%`}
              labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
            />
          }
        />
        <Line
          dataKey="opens"
          type="monotone"
          stroke="var(--color-opens)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="clicks"
          type="monotone"
          stroke="var(--color-clicks)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function InsightsView(): React.ReactNode {
  const [tab, setTab] = useState<"campaigns" | "automated">("campaigns");
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const [type, setType] = useState<CampaignType | "">("");
  const [senderId, setSenderId] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "openRate",
    direction: "desc",
  });
  const query = trpc.campaigns.insights.useQuery({
    days,
    ...(type === "" ? {} : { type }),
    ...(senderId === "" ? {} : { senderId }),
  });

  function toggleSort(key: SortKey): void {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" },
    );
  }

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading insights...</p>;
  }
  if (query.isError || query.data === undefined) {
    return <p className="text-sm text-destructive">Could not load campaign insights.</p>;
  }
  const data = query.data;
  const campaigns = sortedCampaigns(data.campaigns, sort.key, sort.direction);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="w-40">
            <Select
              ariaLabel="Date range"
              value={String(days)}
              onChange={(value) => setDays(value === "30" ? 30 : value === "365" ? 365 : 90)}
              options={DAY_OPTIONS}
            />
          </span>
          <span className="w-44">
            <Select
              ariaLabel="Campaign type"
              value={type}
              onChange={(value) => setType(value === "" ? "" : (value as CampaignType))}
              options={TYPE_OPTIONS}
            />
          </span>
          <span className="w-56">
            <Select
              ariaLabel="Sender"
              value={senderId}
              onChange={setSenderId}
              options={[
                { value: "", label: "All senders" },
                ...data.senders.map((sender) => ({ value: sender.id, label: sender.name })),
              ]}
            />
          </span>
        </div>
        <div className="flex gap-1">
          {(["campaigns", "automated"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-current={tab === value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === value ? "bg-muted font-medium" : "text-muted-foreground"
              }`}
            >
              {value === "campaigns" ? "Campaigns" : "Automated"}
            </button>
          ))}
        </div>
      </div>

      {tab === "campaigns" ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1"
                      >
                        {column.label}
                        {sort.key === column.key ? (
                          <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span>
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-muted/40 font-medium">
                  <td className="px-3 py-2">Your average</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <AverageRateCells average={data.average} />
                </tr>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-3 py-2">
                      <a
                        href={`/campaigns/${campaign.id}/report`}
                        className="text-link-record hover:underline"
                      >
                        {campaign.name}
                      </a>
                    </td>
                    <td className="px-3 py-2">{typeLabel(campaign.type)}</td>
                    <td className="px-3 py-2">{campaign.senderName ?? "-"}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(campaign.recipients)}</td>
                    <td className="px-3 py-2">
                      <RateCell value={campaign.openRate} average={data.average.openRate} />
                    </td>
                    <td className="px-3 py-2">
                      <RateCell value={campaign.clickRate} average={data.average.clickRate} />
                    </td>
                    <td className="px-3 py-2">
                      <RateCell value={campaign.ctor} average={data.average.ctor} />
                    </td>
                    <td className="px-3 py-2">
                      <RateCell
                        value={campaign.unsubscribeRate}
                        average={data.average.unsubscribeRate}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <RateCell value={campaign.bounceRate} average={data.average.bounceRate} />
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-4 text-muted-foreground">
                      No sent campaigns in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Open and click rate over time</h2>
            <TrendChart campaigns={data.campaigns} />
          </section>
        </>
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Sequences</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Sequence</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Steps</th>
                    <th className="px-3 py-2 font-medium">Recipients</th>
                    <th className="px-3 py-2 font-medium">Open</th>
                    <th className="px-3 py-2 font-medium">Click</th>
                    <th className="px-3 py-2 font-medium">CTOR</th>
                    <th className="px-3 py-2 font-medium">Unsub</th>
                    <th className="px-3 py-2 font-medium">Bounce</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="bg-muted/40 font-medium">
                    <td className="px-3 py-2">Your average</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <AverageRateCells average={data.sequenceAverage} />
                  </tr>
                  {data.sequences.map((sequence) => (
                    <tr key={sequence.id}>
                      <td className="px-3 py-2">
                        <a
                          href={`/campaigns/automated/${sequence.id}`}
                          className="text-link-record hover:underline"
                        >
                          {sequence.name}
                        </a>
                      </td>
                      <td className="px-3 py-2">{sequence.status}</td>
                      <td className="px-3 py-2 tabular-nums">{sequence.steps}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatNumber(sequence.recipients)}
                      </td>
                      <SequenceRates row={sequence} average={data.sequenceAverage} />
                    </tr>
                  ))}
                  {data.sequences.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-muted-foreground">
                        No sequence email steps in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Steps</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Sequence / step</th>
                    <th className="px-3 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">Recipients</th>
                    <th className="px-3 py-2 font-medium">Open</th>
                    <th className="px-3 py-2 font-medium">Click</th>
                    <th className="px-3 py-2 font-medium">CTOR</th>
                    <th className="px-3 py-2 font-medium">Unsub</th>
                    <th className="px-3 py-2 font-medium">Bounce</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.steps.map((step) => (
                    <tr key={step.stepId}>
                      <td className="px-3 py-2">
                        {step.sequenceName} / {step.position + 1}
                      </td>
                      <td className="px-3 py-2">{step.subject}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(step.recipients)}</td>
                      <StepRates row={step} />
                    </tr>
                  ))}
                  {data.steps.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-muted-foreground">
                        No sequence email steps in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
