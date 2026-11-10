import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { CampaignEditor } from "@/features/campaigns/ui/CampaignEditor";

export default async function CampaignEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  return (
    <>
      <PageTitle title="Campaign" />
      <CampaignEditor campaignId={id} />
    </>
  );
}
