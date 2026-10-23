"use client";

import { BarChart3, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { tableStyles } from "@/components/ui/table-styles";
import { PILL_TAB, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createDashboardAction, createReportAction } from "../actions";
import { defaultDefinition } from "./builderState";
import { insightErrorMessage } from "./errorCopy";

const S = INSIGHTS_STRINGS;
const TABLE = {
  name: "Name",
  type: "Type",
  updated: "Updated",
  dashboard: "Dashboard",
  report: "Report",
  notShared: "No",
} as const;

// /insights: dashboards and reports in two tabs. "New" creates the row through its server action
// and opens it; the list links to the builder or the dashboard view.

export interface ReportSummary {
  id: string;
  name: string;
  definitionText: string;
  shared: boolean;
  ownerName: string;
  updatedAt: string;
}

export interface DashboardSummary {
  id: string;
  name: string;
  shared: boolean;
  isDefault: boolean;
  ownerName: string;
  widgetCount: number;
  updatedAt: string;
}

interface InsightsTableRow {
  id: string;
  name: string;
  type: string;
  ownerName: string;
  shared: boolean;
  updatedAt: string;
  href: string;
  testId: "dashboard-row" | "report-row";
  isDefault?: boolean;
}

// The Updated column reads an ISO timestamp; UTC keeps the server and client render identical.
function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function InsightsTable({ rows }: { rows: readonly InsightsTableRow[] }): React.ReactNode {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className={tableStyles.table}>
        <thead className="bg-muted/40">
          <tr>
            <th className={tableStyles.th}>{TABLE.name}</th>
            <th className={tableStyles.th}>{TABLE.type}</th>
            <th className={tableStyles.th}>{S.ui.owner}</th>
            <th className={tableStyles.th}>{S.ui.sharedBadge}</th>
            <th className={tableStyles.th}>{TABLE.updated}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-accent/40">
              <td className={tableStyles.td}>
                <span className="flex min-w-0 items-center gap-2">
                  <Link
                    href={row.href}
                    data-testid={row.testId}
                    data-dashboard-id={row.testId === "dashboard-row" ? row.id : undefined}
                    data-report-id={row.testId === "report-row" ? row.id : undefined}
                    className={`${tableStyles.link} truncate font-medium`}
                  >
                    {row.name}
                  </Link>
                  {row.isDefault === true && <Badge>{S.ui.defaultBadge}</Badge>}
                </span>
              </td>
              <td className={tableStyles.td}>{row.type}</td>
              <td className={tableStyles.td}>{row.ownerName}</td>
              <td className={tableStyles.td}>
                {row.shared ? (
                  <Badge variant="secondary">{S.ui.sharedBadge}</Badge>
                ) : (
                  <span className="text-muted-foreground">{TABLE.notShared}</span>
                )}
              </td>
              <td className={`${tableStyles.td} tabular-nums text-muted-foreground`}>
                {formatUpdated(row.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

  const dashboardRows: InsightsTableRow[] = dashboards.map((dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    type: TABLE.dashboard,
    ownerName: dashboard.ownerName,
    shared: dashboard.shared,
    updatedAt: dashboard.updatedAt,
    href: `/insights/dashboards/${dashboard.id}`,
    testId: "dashboard-row",
    isDefault: dashboard.isDefault,
  }));
  const reportRows: InsightsTableRow[] = reports.map((report) => ({
    id: report.id,
    name: report.name,
    type: TABLE.report,
    ownerName: report.ownerName,
    shared: report.shared,
    updatedAt: report.updatedAt,
    href: `/insights/reports/${report.id}`,
    testId: "report-row",
  }));

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
            <InsightsTable rows={dashboardRows} />
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
            <InsightsTable rows={reportRows} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
