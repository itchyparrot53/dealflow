import { notFound } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { db } from "@/db/client";
import { listSequences } from "@/features/campaigns/sequences/queries";
import { SequenceList } from "@/features/campaigns/sequences/ui/SequenceList";
import { CampaignTabs } from "@/features/campaigns/ui/CampaignTabs";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

export default async function AutomatedCampaignsPage(): Promise<React.ReactNode> {
  const { actor } = await createContext();
  if (actor === null || !can(actor, "campaigns.view")) notFound();
  const rows = await listSequences(db, AbortSignal.timeout(10_000));
  return (
    <>
      <PageTitle title="Automated campaigns" />
      <main className="space-y-5 p-6">
        <CampaignTabs active="automated" />
        <SequenceList rows={rows} />
      </main>
    </>
  );
}
