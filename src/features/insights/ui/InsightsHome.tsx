"use client";

import { BarChart3, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PILL_TAB, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createDashboardAction, createReportAction } from "../actions";
import { defaultDefinition } from "./builderState";
import { insightErrorMessage } from "./errorCopy";

const S = INSIGHTS_STRINGS;

// /insights: dashboards and reports in two tabs. "New" creates the row through its server action
// and opens it; the list links to the builder or the dashboard view.

export interface ReportSummary {
  id: string;
  name: string;
  definitionText: string;
  shared: boolean;
  ownerName: string;
}

export interface DashboardSummary {
  id: string;
  name: string;
  shared: boolean;
  isDefault: boolean;
  ownerName: string;
  widgetCount: number;
}

export function InsightsHome({
  reports,
  dashboards,
}: {
  reports: ReportSummary[];
  dashboards: DashboardSummary[];
}): React.ReactNode {
  const router = useRouter();
  const [errorId, setErrorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function newReport(): Promise<void> {
    setCreating(true);
    setErrorId(null);
    const response = await createReportAction(
      {
        name: S.ui.newReport,
        definition: defaultDefinition("deal"),
      },
      readCsrfToken(),
    );
    setCreating(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    router.push(`/insights/reports/${response.value.id}`);
  }

  async function newDashboard(): Promise<void> {
    setCreating(true);
    setErrorId(null);
    const response = await createDashboardAction({ name: S.ui.newDashboard }, readCsrfToken());
    setCreating(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    router.push(`/insights/dashboards/${response.value.id}`);
  }

  return (
    <div data-testid="insights-home" className="space-y-4">
      {errorId !== null && (
        <p role="alert" className="text-sm text-destructive">
          {insightErrorMessage(errorId)}
        </p>
      )}
      <Tabs defaultValue="dashboards" className="space-y-4">
        <TabsList className="gap-1 rounded-md bg-muted p-1">
          <TabsTrigger
            value="dashboards"
            data-testid="insights-tab-dashboards"
            className={PILL_TAB}
          >
            {S.ui.tabDashboards}
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="insights-tab-reports" className={PILL_TAB}>
            {S.ui.tabReports}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="space-y-2">
          <div>
            <Button
              type="button"
              data-testid="dashboard-new"
              disabled={creating}
              onClick={() => void newDashboard()}
            >
              {S.ui.newDashboard}
            </Button>
          </div>
          {dashboards.length === 0 ? (
            <EmptyState
              title={S.ui.noDashboards}
              body="A dashboard gathers the numbers you check most."
              icon={<LayoutDashboard aria-hidden="true" />}
              action={
                <Button size="sm" disabled={creating} onClick={() => void newDashboard()}>
                  {S.ui.newDashboard}
                </Button>
              }
              className="py-10"
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {dashboards.map((dashboard) => (
                <li key={dashboard.id}>
                  <Link
                    href={`/insights/dashboards/${dashboard.id}`}
                    data-testid="dashboard-row"
                    data-dashboard-id={dashboard.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{dashboard.name}</span>
                      {dashboard.isDefault && <Badge>{S.ui.defaultBadge}</Badge>}
                      {dashboard.shared && <Badge variant="secondary">{S.ui.sharedBadge}</Badge>}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {dashboard.ownerName} · {dashboard.widgetCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-2">
          <div>
            <Button
              type="button"
              data-testid="report-new"
              disabled={creating}
              onClick={() => void newReport()}
            >
              {S.ui.newReport}
            </Button>
          </div>
          {reports.length === 0 ? (
            <EmptyState
              title={S.ui.noReports}
              body="A report answers one question about your pipeline."
              icon={<BarChart3 aria-hidden="true" />}
              action={
                <Button size="sm" disabled={creating} onClick={() => void newReport()}>
                  {S.ui.newReport}
                </Button>
              }
              className="py-10"
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/insights/reports/${report.id}`}
                    data-testid="report-row"
                    data-report-id={report.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/50"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{report.name}</span>
                        {report.shared && <Badge variant="secondary">{S.ui.sharedBadge}</Badge>}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {report.definitionText}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {report.ownerName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
