import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listTokens } from "@/features/api/tokens";
import { ApiTokensSettings } from "@/features/api/ui/ApiTokensSettings";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

const S = PROJECTS_API_STRINGS.api;

export const metadata: Metadata = { title: S.title };

// Settings > API. Every signed-in user manages their own tokens; an admin also sees everyone's.
export default async function ApiSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  const tokens = await listTokens(db, actor, AbortSignal.timeout(5000));
  return (
    <SettingsPage className="max-w-5xl">
      <SettingsHeading title={S.title} description={S.intro} />
      <ApiTokensSettings tokens={tokens} />
    </SettingsPage>
  );
}
