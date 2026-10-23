"use client";

import { Pencil } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
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
import { insightErrorMessage } from "./errorCopy";

const S = INSIGHTS_STRINGS;
const RENAME_DASHBOARD = "Rename dashboard";

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // The saved name is the source of truth whenever the input is closed, so an invalidated query
  // update cannot be overwritten by a stale draft.
  const dirty = editing && name !== dashboard.name;

  function startEditing(): void {
    setName(dashboard.name);
    setEditing(true);
  }

  async function persist(patch: { name?: string; shared?: boolean }): Promise<boolean> {
    setError(null);
    const response = await updateDashboardAction(dashboard.id, patch, readCsrfToken());
    if (!response.ok) {
      setError(response.error.id);
      return false;
    }
    await utils.insights.getDashboard.invalidate({ id: dashboard.id });
    return true;
  }

  async function saveName(): Promise<void> {
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === dashboard.name) {
      setName(dashboard.name);
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const saved = await persist({ name: trimmed });
    savingRef.current = false;
    setSaving(false);
    if (!saved) return;
    setName(trimmed);
    setEditing(false);
  }

  function cancelName(): void {
    setName(dashboard.name);
    setEditing(false);
    setError(null);
  }

  return (
    <div data-testid="dashboard-view" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          {canEdit && editing ? (
            <Input
              aria-label={S.ui.dashboardName}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveName();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelName();
                }
              }}
              className="h-10 max-w-md text-title"
            />
          ) : (
            <>
              <h1 data-testid="dashboard-name" className="min-w-0 truncate text-title">
                {canEdit ? (
                  <button
                    type="button"
                    className="max-w-full truncate text-left"
                    onClick={startEditing}
                  >
                    {dashboard.name}
                  </button>
                ) : (
                  dashboard.name
                )}
              </h1>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={RENAME_DASHBOARD}
                  data-testid="dashboard-name-edit"
                  onClick={startEditing}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          {canEdit && (
            <Button
              type="button"
              data-testid="dashboard-save"
              onClick={() => void saveName()}
              disabled={!dirty || name.trim() === "" || saving}
            >
              {S.ui.save}
            </Button>
          )}
          {error !== null && (
            <span role="alert" className="text-sm text-destructive">
              {insightErrorMessage(error)}
            </span>
          )}
        </div>
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
