import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { buildApiDocSections } from "@/features/api/docs";
import { API_ROUTES } from "@/features/api/registry";
import { listTokens } from "@/features/api/tokens";
import { ApiDocs } from "@/features/api/ui/ApiDocs";
import { ApiTokensSettings } from "@/features/api/ui/ApiTokensSettings";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

const S = PROJECTS_API_STRINGS.api;

export const metadata: Metadata = { title: S.title };

// Settings > API: personal tokens and the in-app route documentation (the same registry that
// generates docs/API.md). Every signed-in user manages their own tokens; an admin sees everyone's.
export default async function ApiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  const [tokens, params] = await Promise.all([
    listTokens(db, actor, AbortSignal.timeout(5000)),
    searchParams,
  ]);
  const sections = buildApiDocSections(API_ROUTES);
  return (
    <SettingsPage className="max-w-5xl">
      <SettingsHeading title={S.title} description={S.intro} />
      <Tabs defaultValue={params.tab === "docs" ? "docs" : "tokens"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tokens" data-testid="api-tab-tokens">
            {S.tokensTab}
          </TabsTrigger>
          <TabsTrigger value="docs" data-testid="api-tab-docs">
            {S.docsTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tokens">
          <ApiTokensSettings tokens={tokens} />
        </TabsContent>
        <TabsContent value="docs">
          <ApiDocs sections={sections} />
        </TabsContent>
      </Tabs>
    </SettingsPage>
  );
}
