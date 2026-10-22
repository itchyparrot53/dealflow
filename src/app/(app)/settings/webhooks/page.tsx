import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { WEBHOOKS_STRINGS } from "@/constants/automationsStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { can } from "@/features/permissions/can";
import { listSubscriptions } from "@/features/webhooks/service";
import { WebhooksSettings } from "@/features/webhooks/ui/WebhooksSettings";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: WEBHOOKS_STRINGS.title };

// Settings > Webhooks. Admin only, like Settings > Automations.
export default async function WebhooksSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (!can(actor, "automations.manage")) {
    return <p className="text-sm text-destructive">{WEBHOOKS_STRINGS.adminOnly}</p>;
  }

  const rows = await listSubscriptions(db, AbortSignal.timeout(5000));
  return (
    <SettingsPage className="max-w-5xl">
      <PageTitle title="Webhooks" />
      <SettingsHeading title={WEBHOOKS_STRINGS.title} description={WEBHOOKS_STRINGS.intro} />
      <WebhooksSettings
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          url: row.url,
          events: row.events,
          enabled: row.enabled,
          consecutiveFailures: row.consecutiveFailures,
          disabledReason: row.disabledReason,
          lastDeliveryAt: row.lastDeliveryAt?.toISOString() ?? null,
        }))}
      />
    </SettingsPage>
  );
}
