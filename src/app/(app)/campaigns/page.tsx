import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { CampaignsPage } from "@/features/campaigns/ui/CampaignsPage";

export default function CampaignsRoute(): React.ReactNode {
  return (
    <>
      <PageTitle title="Campaigns" />
      <CampaignsPage />
    </>
  );
}
