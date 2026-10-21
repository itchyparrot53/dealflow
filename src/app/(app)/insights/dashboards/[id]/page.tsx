import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type React from "react";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { db } from "@/db/client";
import { readBaseCurrency } from "@/features/currency/rates";
import { getDashboard } from "@/features/insights/dashboards";
import { listReports } from "@/features/insights/reports";
import { DashboardView } from "@/features/insights/ui/DashboardView";
import { isUuidParam } from "@/lib/isUuidParam";
import { createContext } from "@/server/trpc/context";

const S = INSIGHTS_STRINGS;

export const metadata: Metadata = { title: S.ui.title };

// /insights/dashboards/{id}. The widget list is filtered by the service, so a shared dashboard
// never renders a report its viewer may not read.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  if (!isUuidParam(id)) notFound();

  const ctx = await createContext();
  if (ctx.actor === null) redirect("/login");

  const signal = AbortSignal.timeout(10_000);
  const dashboard = await getDashboard(db, ctx.actor, id, signal);
  if (!dashboard.ok) notFound();

  const [reports, currency] = await Promise.all([
    listReports(db, ctx.actor, signal),
    readBaseCurrency(db, signal),
  ]);
  const canEdit = ctx.actor.type === "admin" || ctx.actor.id === dashboard.value.ownerId;

  return (
    <main aria-label={dashboard.value.name} className="space-y-4 p-4">
      <h1 className="text-display font-[450] leading-tight tracking-tight">
        {dashboard.value.name}
      </h1>
      <DashboardView
        dashboard={dashboard.value}
        reports={reports.map((report) => ({
          id: report.id,
          name: report.name,
          definition: report.definition,
          shared: report.shared,
        }))}
        canEdit={canEdit}
        currency={currency}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  );
}
