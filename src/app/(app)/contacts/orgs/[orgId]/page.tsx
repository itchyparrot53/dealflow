import type { Metadata } from "next";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { STRINGS } from "@/constants/strings";
import { entityTitle } from "@/features/navigation/pageTitle";
import { loadOrg, OrgDetailView } from "./OrgDetailView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgId: string }>;
}): Promise<Metadata> {
  const { orgId } = await params;
  const loaded = await loadOrg(orgId);
  const name = loaded.kind === "ok" ? loaded.value.name : null;
  return { title: entityTitle(name, STRINGS.titles.orgFallback) };
}

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}): Promise<React.ReactNode> {
  const { orgId } = await params;
  return (
    <>
      <PageTitle title="Organizations" />
      <OrgDetailView orgId={orgId} />
    </>
  );
}
