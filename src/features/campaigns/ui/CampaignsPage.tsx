"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from "@/constants/campaigns";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createCampaignAction, deleteCampaignAction, duplicateCampaignAction } from "../actions";
import { CAMPAIGN_STARTERS } from "../blocks/starters";
import { InsightsView } from "./InsightsView";
import { TemplatesView } from "./TemplatesView";

// 3.1's list page. Automated and Insights are added in Phase 4; the tab row grows then, rather
// than shipping two tabs that render nothing.

// Widened lookups: the constants are keyed by the union, while a row's stored string is validated
// by the database check rather than narrowed by TS.
const TYPE_LABELS: Record<string, string> = CAMPAIGN_TYPE_LABELS;
const STATUS_LABELS: Record<string, string> = CAMPAIGN_STATUS_LABELS;

function formatRate(rate: number | null): string {
  return rate === null ? "-" : `${(rate * 100).toFixed(1)}%`;
}

function formatDate(value: string | null): string {
  return value === null ? "-" : new Date(value).toLocaleDateString();
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "secondary",
  paused: "secondary",
  sent: "success",
  cancelled: "destructive",
};

export function CampaignsPage({
  initialView = "campaigns",
}: {
  initialView?: "campaigns" | "templates" | "insights";
}): React.ReactNode {
  const router = useRouter();
  const [tab, setTab] = useState<"campaigns" | "templates" | "insights">(initialView);
  const [error, setError] = useState<string | null>(null);
  const list = trpc.campaigns.list.useQuery();
  const subscribed = trpc.marketing.subscribedCount.useQuery();
  const utils = trpc.useUtils();

  async function create(content?: unknown, name?: string): Promise<void> {
    setError(null);
    const result = await createCampaignAction(
      { name: name ?? "Untitled campaign", content: content ?? null },
      readCsrfToken(),
    );
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.push(`/campaigns/${result.value.id}`);
  }

  async function duplicate(id: string): Promise<void> {
    setError(null);
    const result = await duplicateCampaignAction({ id }, readCsrfToken());
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.push(`/campaigns/${result.value.id}`);
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    const result = await deleteCampaignAction({ id }, readCsrfToken());
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    await utils.campaigns.list.invalidate();
  }

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {subscribed.data ?? 0} subscribed {subscribed.data === 1 ? "contact" : "contacts"}
        </p>
        <Button type="button" onClick={() => void create()}>
          + Campaign
        </Button>
      </header>

      <div className="flex gap-1 border-b">
        {(["campaigns", "templates", "insights"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? "page" : undefined}
            className={`px-3 py-2 text-sm ${tab === value ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {value === "campaigns" ? "Campaigns" : value === "templates" ? "Templates" : "Insights"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => router.push("/campaigns/automated")}
          className="px-3 py-2 text-sm text-muted-foreground"
        >
          Automated
        </button>
      </div>

      {error === null ? null : <p className="text-sm text-destructive">{error}</p>}

      {tab === "insights" ? (
        <InsightsView />
      ) : tab === "templates" ? (
        <TemplatesView onUse={(document, name) => void create(document, name)} />
      ) : (list.data ?? []).length === 0 ? (
        <section className="space-y-3 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Create your first campaign</h2>
          <p className="text-sm text-muted-foreground">Start from a template or a blank page.</p>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_STARTERS.map((starter) => (
              <Button
                key={starter.key}
                type="button"
                variant="outline"
                onClick={() => void create(starter.document, starter.name)}
              >
                {starter.name}
              </Button>
            ))}
          </div>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Recipients</th>
                <th className="px-3 py-2 font-medium">Open rate</th>
                <th className="px-3 py-2 font-medium">Click rate</th>
                <th className="px-3 py-2 font-medium">Sent or scheduled</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(list.data ?? []).map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-3 py-2">
                    <a
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium text-link-record hover:underline"
                    >
                      {campaign.name}
                    </a>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {TYPE_LABELS[campaign.type] ?? campaign.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[campaign.status] ?? "outline"}>
                      {STATUS_LABELS[campaign.status] ?? campaign.status}
                    </Badge>
                    {campaign.status === "scheduled" && campaign.scheduledAt !== null ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Scheduled {new Date(campaign.scheduledAt).toLocaleString()}
                      </span>
                    ) : null}
                    {campaign.status === "sending" && campaign.sendingPercent !== null ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Sending {campaign.sendingPercent}%
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {campaign.totals.recipients ?? 0}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatRate(campaign.openRate)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatRate(campaign.clickRate)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(
                      campaign.status === "scheduled"
                        ? campaign.scheduledAt
                        : (campaign.startedAt ?? campaign.finishedAt),
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {campaign.ownerName ?? "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {campaign.status === "sent" ||
                    campaign.status === "sending" ||
                    campaign.status === "paused" ? (
                      <a
                        href={`/campaigns/${campaign.id}/report`}
                        className="mr-2 text-sm text-link-record hover:underline"
                      >
                        Report
                      </a>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Actions for ${campaign.name}`}
                          data-testid="campaign-row-menu"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          data-testid="campaign-duplicate"
                          onSelect={() => void duplicate(campaign.id)}
                        >
                          Duplicate
                        </DropdownMenuItem>
                        {campaign.status === "draft" ? (
                          <DropdownMenuItem onSelect={() => void remove(campaign.id)}>
                            Delete draft
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
