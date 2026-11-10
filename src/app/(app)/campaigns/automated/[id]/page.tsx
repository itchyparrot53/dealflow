import { notFound } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { db } from "@/db/client";
import { getSequenceEditorView } from "@/features/campaigns/sequences/queries";
import { SequenceEditor } from "@/features/campaigns/sequences/ui/SequenceEditor";
import { CampaignTabs } from "@/features/campaigns/ui/CampaignTabs";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

export default async function SequenceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  const { actor } = await createContext();
  if (actor === null || !can(actor, "campaigns.view")) notFound();
  const view = await getSequenceEditorView(db, actor, id, AbortSignal.timeout(10_000));
  if (view === null) notFound();
  return (
    <>
      <PageTitle title="Automated campaign" />
      <main className="space-y-5 p-6">
        <CampaignTabs active="automated" />
        <SequenceEditor view={view} />
      </main>
    </>
  );
}
