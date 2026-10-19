import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AI_STRINGS } from "@/constants/aiStrings";
import { createContext } from "@/server/trpc/context";
import { createCaller } from "@/server/trpc/root";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";
import { AiSettingsClient } from "./AiSettingsClient";

export const metadata = { title: AI_STRINGS.title };

// Admin-only page: the nav hides it for everyone else, but hiding is not a boundary.
export default async function AiSettingsPage(): Promise<ReactNode> {
  const ctx = await createContext();
  if (ctx.actor === null || ctx.actor.type !== "admin") notFound();

  const caller = createCaller(ctx);
  const overview = await caller.ai.overview();

  return (
    <SettingsPage>
      <SettingsHeading title={AI_STRINGS.title} description={AI_STRINGS.description} />
      <AiSettingsClient
        overview={{
          settings: {
            enabled: overview.settings.enabled,
            companyMonthlyTokenLimit: overview.settings.companyMonthlyTokenLimit,
            userMonthlyTokenLimit: overview.settings.userMonthlyTokenLimit,
          },
          usage: {
            companyUsed: overview.usage.companyUsed,
            byFeature: overview.usage.byFeature,
            byUser: overview.usage.byUser,
          },
          model: overview.model,
          providerKind: overview.providerKind,
        }}
      />
    </SettingsPage>
  );
}
