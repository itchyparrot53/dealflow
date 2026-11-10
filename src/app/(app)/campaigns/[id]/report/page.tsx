import { notFound } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { db } from "@/db/client";
import { getCampaignReport } from "@/features/campaigns/reports";
import { ReportView } from "@/features/campaigns/ui/ReportView";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  const { actor } = await createContext();
  if (actor === null || !can(actor, "campaigns.view")) notFound();
  const report = await getCampaignReport(db, actor, id, AbortSignal.timeout(20_000));
  if (report === null) notFound();
  return (
    <>
      <PageTitle title="Campaign report" />
      <main className="space-y-5 p-6">
        <a href={`/campaigns/${id}`} className="text-sm text-link-record hover:underline">
          Back to campaign
        </a>
        <ReportView report={report} canExport={can(actor, "data.export")} />
      </main>
    </>
  );
}
