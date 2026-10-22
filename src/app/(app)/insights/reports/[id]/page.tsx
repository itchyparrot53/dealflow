import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type React from "react";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { db } from "@/db/client";
import { getReport } from "@/features/insights/reports";
import { ReportBuilder } from "@/features/insights/ui/ReportBuilder";
import { isUuidParam } from "@/lib/isUuidParam";
import { createContext } from "@/server/trpc/context";
import { createCaller } from "@/server/trpc/root";

const S = INSIGHTS_STRINGS;

export const metadata: Metadata = { title: S.ui.title };

// /insights/reports/{id}: the saved report's builder. The definition is read through the service,
// so an unshared report of someone else is a 404 rather than a permission error.
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  if (!isUuidParam(id)) notFound();

  const ctx = await createContext();
  if (ctx.actor === null) redirect("/login");

  const report = await getReport(db, ctx.actor, id, AbortSignal.timeout(10_000));
  if (!report.ok) notFound();

  const pipelines = await createCaller(ctx).pipeline.list();
  const canEdit = ctx.actor.type === "admin" || ctx.actor.id === report.value.ownerId;

  return (
    <main aria-label={report.value.name} className="space-y-4 p-4">
      <h1 className="text-title">{report.value.name}</h1>
      <ReportBuilder
        reportId={report.value.id}
        initial={{
          name: report.value.name,
          definition: report.value.definition,
          shared: report.value.shared,
        }}
        canEdit={canEdit}
        pipelines={pipelines.map((pipeline) => ({
          id: pipeline.id,
          name: pipeline.name,
          stages: pipeline.stages.map((stage) => ({ id: stage.id, name: stage.name })),
        }))}
      />
    </main>
  );
}
