"use client";

import { ArrowDown, ArrowUp, Maximize2, Minimize2, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import type { GoalWithProgress } from "@/features/goals/router";
import { GoalRow } from "@/features/stats/ui/GoalsWidget";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { moveWidgetAction, removeWidgetAction, resizeWidgetAction } from "../actions";
import type { DashboardWidgetView } from "../dashboards";
import type { ReportDefinition } from "../definition";
import type { ReportResult } from "../result";
import { ReportChart } from "./ReportChart";

const S = INSIGHTS_STRINGS;

export interface DashboardReport {
  id: string;
  name: string;
  definition: ReportDefinition;
  shared: boolean;
}

function WidgetMenu({
  widget,
  onMove,
  onResize,
  onRemove,
}: {
  widget: DashboardWidgetView;
  onMove: (direction: "up" | "down") => void;
  onResize: () => void;
  onRemove: () => void;
}): React.ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label={S.ui.widgetMenu}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {widget.reportId !== null && (
          <DropdownMenuItem asChild>
            <Link href={`/insights/reports/${widget.reportId}`}>{S.ui.openReport}</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onMove("up")}>
          <ArrowUp className="size-4" aria-hidden="true" />
          {S.ui.moveUp}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMove("down")}>
          <ArrowDown className="size-4" aria-hidden="true" />
          {S.ui.moveDown}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onResize}>
          {widget.size === "full" ? (
            <Minimize2 className="size-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-4" aria-hidden="true" />
          )}
          {widget.size === "full" ? S.ui.makeHalf : S.ui.makeFull}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRemove}>
          <Trash2 className="size-4" aria-hidden="true" />
          {S.ui.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReportBody({
  report,
  result,
  loading,
  failed,
}: {
  report: DashboardReport | undefined;
  result: ReportResult | undefined;
  loading: boolean;
  failed: boolean;
}): React.ReactNode {
  if (report === undefined) return <p className="text-sm text-muted-foreground">{S.ui.error}</p>;
  if (loading) return <p className="text-sm text-muted-foreground">{S.ui.loading}</p>;
  if (failed || result === undefined) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {S.ui.error}
      </p>
    );
  }
  return <ReportChart result={result} definition={report.definition} description={report.name} />;
}

function GoalBody({
  row,
  currency,
}: {
  row: GoalWithProgress | undefined;
  currency: string;
}): React.ReactNode {
  if (row === undefined) return <p className="text-sm text-muted-foreground">{S.ui.error}</p>;
  return <GoalRow row={row} currency={currency} />;
}

// One dashboard widget. A report widget runs its own query, so each widget loads and fails
// independently; a goal widget reuses the stats goal row component.

export function DashboardWidget({
  widget,
  dashboardId,
  canEdit,
  reports,
  goals,
  currency,
}: {
  widget: DashboardWidgetView;
  dashboardId: string;
  canEdit: boolean;
  reports: readonly DashboardReport[];
  goals: readonly GoalWithProgress[];
  currency: string;
}): React.ReactNode {
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  const report =
    widget.reportId === null ? undefined : reports.find((r) => r.id === widget.reportId);
  const goalRow =
    widget.goalId === null ? undefined : goals.find((row) => row.goal.id === widget.goalId);
  const run = trpc.insights.run.useQuery(
    { reportId: widget.reportId ?? "" },
    { enabled: widget.kind === "report" && report !== undefined, retry: false },
  );

  async function act(action: Promise<{ ok: boolean; error?: { id: string } }>): Promise<void> {
    setError(null);
    const result = await action;
    if (!result.ok) {
      setError(result.error?.id ?? S.ui.error);
      return;
    }
    await utils.insights.getDashboard.invalidate({ id: dashboardId });
  }

  const title = widget.kind === "report" ? (report?.name ?? S.ui.tabReports) : S.ui.goals;

  return (
    <section
      data-testid="dashboard-widget"
      data-widget-id={widget.id}
      className="rounded-lg border p-4"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium text-muted-foreground">{title}</h2>
        {canEdit && (
          <WidgetMenu
            widget={widget}
            onMove={(direction) =>
              void act(moveWidgetAction(widget.id, direction, readCsrfToken()))
            }
            onResize={() =>
              void act(
                resizeWidgetAction(
                  widget.id,
                  widget.size === "full" ? "half" : "full",
                  readCsrfToken(),
                ),
              )
            }
            onRemove={() => void act(removeWidgetAction(widget.id, readCsrfToken()))}
          />
        )}
      </header>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {widget.kind === "report" ? (
        <ReportBody
          report={report}
          result={run.data}
          loading={run.isLoading}
          failed={run.isError}
        />
      ) : (
        <GoalBody row={goalRow} currency={currency} />
      )}
    </section>
  );
}
