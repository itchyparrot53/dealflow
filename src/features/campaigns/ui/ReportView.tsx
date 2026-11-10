"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Select } from "@/components/ui/Select";
import { formatNumber } from "@/lib/format/number";
import {
  type CampaignRecipientStatus,
  type CampaignReport,
  campaignRates,
  RECIPIENT_STATUS_LABELS,
} from "../reportsShared";

// 6.11's report surface. Every rate comes from the shared pure formula so the tiles, the CSV and
// the insights view agree; the machine-open toggle only swaps the unique-open numerator.

const CHART_CONFIG: ChartConfig = {
  opens: { label: "Opens", color: "hsl(var(--chart-1))" },
  clicks: { label: "Clicks", color: "hsl(var(--chart-2))" },
};

const STATUS_OPTIONS: { value: "all" | CampaignRecipientStatus; label: string }[] = [
  { value: "all", label: "All recipients" },
  ...(Object.entries(RECIPIENT_STATUS_LABELS) as [CampaignRecipientStatus, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];

function rateText(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function bucketLabel(label: string, kind: "hour" | "day"): string {
  const date = new Date(label);
  return kind === "hour"
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateText(value: string | null): string {
  return value === null ? "-" : new Date(value).toLocaleString();
}

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}): React.ReactNode {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail === undefined ? null : (
        <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
      )}
    </div>
  );
}

export function ReportView({
  report,
  canExport,
}: {
  report: CampaignReport;
  canExport: boolean;
}): React.ReactNode {
  const [includeMachineOpens, setIncludeMachineOpens] = useState(false);
  const [filter, setFilter] = useState<"all" | CampaignRecipientStatus>("all");
  const rates = campaignRates(report.summary, includeMachineOpens);
  const opens = includeMachineOpens ? report.summary.uniqueOpensAll : report.summary.uniqueOpens;
  const recipients =
    filter === "all"
      ? report.recipients
      : report.recipients.filter((recipient) => recipient.status === filter);
  const hasActivity = report.series.some((point) => point.opens + point.clicks > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold">{report.campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {report.campaign.subject} · {report.campaign.status}
          </p>
        </div>
        {canExport ? (
          <a
            href={`/campaigns/${report.campaign.id}/report/recipients.csv`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Export CSV
          </a>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Recipients" value={formatNumber(report.summary.recipients)} />
        <Tile label="Delivered" value={formatNumber(report.summary.delivered)} />
        <Tile
          label={includeMachineOpens ? "Unique opens (all)" : "Unique opens"}
          value={formatNumber(opens)}
          detail={rateText(rates.openRate)}
        />
        <Tile
          label="Unique clicks"
          value={formatNumber(report.summary.uniqueClicks)}
          detail={rateText(rates.clickRate)}
        />
        <Tile label="Click-to-open" value={rateText(rates.ctor)} />
        <Tile
          label="Unsubscribes"
          value={formatNumber(report.summary.unsubscribes)}
          detail={rateText(rates.unsubscribeRate)}
        />
        <Tile
          label="Bounces"
          value={`${formatNumber(report.summary.bouncesHard)} hard, ${formatNumber(report.summary.bouncesSoft)} soft`}
          detail={rateText(rates.bounceRate)}
        />
        <Tile label="Reported as spam" value={formatNumber(report.summary.complaints)} />
      </section>

      <label htmlFor="include-machine-opens" className="flex items-center gap-2 text-sm">
        <Checkbox
          id="include-machine-opens"
          checked={includeMachineOpens}
          onCheckedChange={setIncludeMachineOpens}
          label="Include machine opens"
        />
        Include machine opens
      </label>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Opens and clicks</h2>
        {hasActivity ? (
          <ChartContainer config={CHART_CONFIG} className="h-72">
            <LineChart data={report.series}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={16}
                tickFormatter={(value: string) => bucketLabel(value, report.seriesKind)}
              />
              <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatValue={(value) => formatNumber(Number(value ?? 0))}
                    labelFormatter={(label) => bucketLabel(String(label), report.seriesKind)}
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
        ) : (
          <p className="text-sm text-muted-foreground">No opens or clicks yet.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Links</h2>
        {report.links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracked links.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Unique clicks</th>
                  <th className="px-3 py-2 font-medium">Total clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.links.map((link) => (
                  <tr key={link.index}>
                    <td className="max-w-[42rem] break-all px-3 py-2">{link.url}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(link.uniqueClicks)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(link.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Recipients</h2>
          <span className="w-48">
            <Select
              ariaLabel="Filter recipients by status"
              value={filter}
              onChange={(value) => setFilter(value as "all" | CampaignRecipientStatus)}
              options={STATUS_OPTIONS}
            />
          </span>
        </div>
        {report.recipientTotal > report.recipients.length ? (
          <p className="text-xs text-muted-foreground">
            Showing the first {formatNumber(report.recipients.length)} of{" "}
            {formatNumber(report.recipientTotal)} recipients. Export CSV for the full list.
          </p>
        ) : null}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td className="px-3 py-2">
                    {recipient.personId === null ? (
                      <span className="text-muted-foreground">{recipient.name}</span>
                    ) : (
                      <a
                        href={`/contacts/people/${recipient.personId}`}
                        className="text-link-record hover:underline"
                      >
                        {recipient.name}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{recipient.email}</td>
                  <td className="px-3 py-2">{RECIPIENT_STATUS_LABELS[recipient.status]}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {dateText(recipient.lastActivity)}
                  </td>
                </tr>
              ))}
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    No recipients in this status.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
