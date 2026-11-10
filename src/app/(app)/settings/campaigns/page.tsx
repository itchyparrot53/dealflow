import { notFound } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { db } from "@/db/client";
import { listSenders } from "@/features/campaigns/senders";
import { getCampaignSettings } from "@/features/campaigns/settings";
import { CampaignSettingsClient } from "@/features/campaigns/ui/settings/CampaignSettingsClient";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

export default async function CampaignSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}): Promise<React.ReactNode> {
  const { actor } = await createContext();
  if (actor === null || !can(actor, "marketing.manage")) notFound();
  const { verified } = await searchParams;
  const signal = AbortSignal.timeout(10_000);
  const [settings, senders] = await Promise.all([
    getCampaignSettings(db, signal),
    listSenders(db, signal),
  ]);
  return (
    <>
      <PageTitle title="Campaigns" />
      <CampaignSettingsClient
        settings={settings}
        senders={senders}
        verified={verified === "1" ? true : verified === "0" ? false : null}
      />
    </>
  );
}
