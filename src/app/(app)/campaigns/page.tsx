import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { CampaignsPage } from "@/features/campaigns/ui/CampaignsPage";

export default async function CampaignsRoute({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}): Promise<React.ReactNode> {
  const { view } = await searchParams;
  const initialView = view === "insights" || view === "templates" ? view : "campaigns";
  return (
    <>
      <PageTitle title="Campaigns" />
      <CampaignsPage initialView={initialView} />
    </>
  );
}
