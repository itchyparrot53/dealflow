import type { ReactNode } from "react";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listAutomations } from "@/features/automations/service";
import { AutomationsList } from "@/features/automations/ui/AutomationsList";
import { triggerSummary } from "@/features/automations/ui/summaries";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: AUTOMATIONS_STRINGS.title };

// Settings > Automations. Admin only; the nav hides the link, and this gate is the boundary.
export default async function AutomationsSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (!can(actor, "automations.manage")) {
    return <p className="text-sm text-destructive">{AUTOMATIONS_STRINGS.adminOnly}</p>;
  }

  const rows = await listAutomations(db, AbortSignal.timeout(5000));
  return (
    <SettingsPage className="max-w-5xl">
      <SettingsHeading title={AUTOMATIONS_STRINGS.title} description={AUTOMATIONS_STRINGS.intro} />
      <AutomationsList
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          runCount: row.runCount,
          lastRunAt: row.lastRunAt?.toISOString() ?? null,
          triggerSummary: triggerSummary(row.definition),
        }))}
      />
    </SettingsPage>
  );
}
