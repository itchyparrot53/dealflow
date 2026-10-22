import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type React from "react";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { db } from "@/db/client";
import { listDashboards } from "@/features/insights/dashboards";
import { ensureDefaultDashboard } from "@/features/insights/defaultDashboard";
import { describeDefinition } from "@/features/insights/definition";
import { listReports } from "@/features/insights/reports";
import { InsightsHome } from "@/features/insights/ui/InsightsHome";
import { createContext } from "@/server/trpc/context";

const S = INSIGHTS_STRINGS;

export const metadata: Metadata = { title: S.ui.title };

// /insights. The first visit creates the "Sales overview" dashboard; a failure there must not stop
// the lists from rendering, so the result is deliberately ignored.
export default async function InsightsPage(): Promise<React.ReactNode> {
  const { actor } = await createContext();
  if (actor === null) redirect("/login");

  const signal = AbortSignal.timeout(10_000);
  await ensureDefaultDashboard(db, signal);
  const [reports, dashboards] = await Promise.all([
    listReports(db, actor, signal),
    listDashboards(db, actor, signal),
  ]);

  return (
    <main aria-label={S.ui.title} className="space-y-4 p-4">
      <h1 className="text-title">{S.ui.title}</h1>
      <InsightsHome
        reports={reports.map((report) => ({
          id: report.id,
          name: report.name,
          definitionText: describeDefinition(report.definition, {}),
          shared: report.shared,
          ownerName: report.ownerName,
        }))}
        dashboards={dashboards.map((dashboard) => ({
          id: dashboard.id,
          name: dashboard.name,
          shared: dashboard.shared,
          isDefault: dashboard.isDefault,
          ownerName: dashboard.ownerName,
          widgetCount: dashboard.widgets.length,
        }))}
      />
    </main>
  );
}
