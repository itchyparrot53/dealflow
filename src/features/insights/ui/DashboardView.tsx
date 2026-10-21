"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { updateDashboardAction } from "../actions";
import type { DashboardView as DashboardData } from "../dashboards";
import { AddWidgetDialog } from "./AddWidgetDialog";
import { type DashboardReport, DashboardWidget } from "./DashboardWidget";

const S = INSIGHTS_STRINGS;

// /insights/dashboards/{id}: a two-column grid on desktop and one column on mobile. Widgets load
// in parallel because each report widget owns its query; a slow or failing report does not hold
// the rest of the dashboard.

export function DashboardView({
  dashboard: initial,
  reports,
  canEdit,
  currency,
  today,
}: {
  dashboard: DashboardData;
  reports: readonly DashboardReport[];
  canEdit: boolean;
  currency: string;
  today: string;
}): React.ReactNode {
  const utils = trpc.useUtils();
  const query = trpc.insights.getDashboard.useQuery({ id: initial.id }, { initialData: initial });
  const goals = trpc.goals.list.useQuery({ on: today });
  const dashboard = query.data;
  const [name, setName] = useState(initial.name);
  const [error, setError] = useState<string | null>(null);

  async function persist(patch: { name?: string; shared?: boolean }): Promise<void> {
    setError(null);
    const response = await updateDashboardAction(dashboard.id, patch, readCsrfToken());
    if (!response.ok) {
      setError(response.error.id);
      return;
    }
    await utils.insights.getDashboard.invalidate({ id: dashboard.id });
  }

  return (
    <div data-testid="dashboard-view" className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={S.ui.dashboardName}
          value={name}
          disabled={!canEdit}
          onChange={(event) => setName(event.target.value)}
          className="max-w-xs"
        />
        {canEdit && (
          <Button type="button" onClick={() => void persist({ name })}>
            {S.ui.save}
          </Button>
        )}
        {canEdit && (
          <span className="flex items-center gap-2 text-sm">
            <Switch
              checked={dashboard.shared}
              onCheckedChange={(value) => void persist({ shared: value })}
              label={S.ui.sharedBadge}
              testId="dashboard-share"
            />
            {S.ui.sharedBadge}
          </span>
        )}
        {canEdit && (
          <AddWidgetDialog
            dashboardId={dashboard.id}
            reports={reports}
            goals={goals.data ?? []}
            onAdded={() => utils.insights.getDashboard.invalidate({ id: dashboard.id })}
          />
        )}
        {error !== null && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </header>

      {dashboard.widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.ui.noWidgets}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.widgets.map((widget) => (
            <div key={widget.id} className={widget.size === "full" ? "md:col-span-2" : ""}>
              <DashboardWidget
                widget={widget}
                dashboardId={dashboard.id}
                canEdit={canEdit}
                reports={reports}
                goals={goals.data ?? []}
                currency={currency}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
