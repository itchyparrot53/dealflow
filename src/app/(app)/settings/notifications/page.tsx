"use client";

import { useState } from "react";
import type { NotificationType } from "@/constants/notificationTypes";
import { NOTIFICATION_TYPES } from "@/constants/notificationTypes";
import { STRINGS } from "@/constants/strings";
import { setPreferenceAction } from "@/features/notifications/actions";
import { PreferencesForm } from "@/features/notifications/ui/PreferencesForm";
import { setPushPrefAction } from "@/features/push/actions";
import { PushSettings } from "@/features/push/ui/PushSettings";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsCard, SettingsCardHeader, SettingsPage } from "../SettingsSurface";

const { pageTitle, loading, saveError } = STRINGS.notifications.preferences;

type Channels = { inApp: boolean; email: boolean; push: boolean };

export default function NotificationSettingsPage() {
  const utils = trpc.useUtils();
  const prefs = trpc.notifications.preferences.useQuery();
  const pushPrefs = trpc.push.preferences.useQuery();
  const [error, setError] = useState<string | null>(null);

  async function handleChange(type: NotificationType, next: Channels) {
    setError(null);
    // One switch changed but both rows are written: the in-app/email action always writes both
    // columns, and the push action is an upsert, so a no-op push write is harmless.
    const [channels, push] = await Promise.all([
      setPreferenceAction({ type, inApp: next.inApp, email: next.email }, readCsrfToken()),
      setPushPrefAction({ type, enabled: next.push }, readCsrfToken()),
    ]);
    if (channels.ok && push.ok) {
      void utils.notifications.preferences.invalidate();
      void utils.push.preferences.invalidate();
    } else {
      setError(saveError);
    }
  }

  if (!prefs.data || !pushPrefs.data) {
    return <p className="text-sm text-muted-foreground">{loading}</p>;
  }

  const merged = Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [type, { ...prefs.data[type], push: pushPrefs.data[type] }]),
  ) as Record<NotificationType, Channels>;

  return (
    <SettingsPage>
      <SettingsHeading title={pageTitle} description={STRINGS.settings.notificationsDescription} />
      {error !== null && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <SettingsCard>
        <SettingsCardHeader
          title="Push notifications"
          description="Send notifications to this browser or device, even when the app is closed."
        />
        <PushSettings />
      </SettingsCard>
      <SettingsCard>
        <SettingsCardHeader
          title="Notification channels"
          description="Choose how each kind of update reaches you."
        />
        <div className="px-5">
          <PreferencesForm
            prefs={merged}
            onChange={(type, next) => void handleChange(type, next)}
          />
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
