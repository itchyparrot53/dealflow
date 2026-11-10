"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from "@/constants/campaigns";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createCampaignAction, deleteCampaignAction } from "../actions";
import { CAMPAIGN_STARTERS } from "../blocks/starters";
import { TemplatesView } from "./TemplatesView";

// 3.1's list page. Automated and Insights are added in Phase 4; the tab row grows then, rather
// than shipping two tabs that render nothing.

// Widened lookups: the constants are keyed by the union, while a row's stored string is validated
// by the database check rather than narrowed by TS.
const TYPE_LABELS: Record<string, string> = CAMPAIGN_TYPE_LABELS;
const STATUS_LABELS: Record<string, string> = CAMPAIGN_STATUS_LABELS;

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "secondary",
  paused: "secondary",
  sent: "success",
  cancelled: "destructive",
};

export function CampaignsPage(): React.ReactNode {
  const router = useRouter();
  const [tab, setTab] = useState<"campaigns" | "templates">("campaigns");
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
        {(["campaigns", "templates"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? "page" : undefined}
            className={`px-3 py-2 text-sm ${tab === value ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {value === "campaigns" ? "Campaigns" : "Templates"}
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

      {tab === "templates" ? (
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
                <th className="px-3 py-2 font-medium">Created</th>
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
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {campaign.totals.recipients ?? 0}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleDateString()}
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
                    {campaign.status === "draft" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void remove(campaign.id)}
                      >
                        Delete
                      </Button>
                    ) : null}
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
