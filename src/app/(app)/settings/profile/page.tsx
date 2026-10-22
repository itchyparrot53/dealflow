import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { DEFAULT_DAILY_ACTIVITY_TARGET } from "@/constants/activityLoad";
import { STRINGS } from "@/constants/strings";
import { db } from "@/db/client";
import { users } from "@/db/schema/identity";
import { getCredentials } from "@/features/auth/credentials";
import { recentLinkSignIn } from "@/features/auth/sessionAuth";
import { interfacePrefsFromUi } from "@/features/identity/interfacePrefs";
import { getPreferencesForActor } from "@/features/identity/preferencesForActor";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";
import { DailyActivityTarget } from "./DailyActivityTarget";
import { InterfacePreferences } from "./InterfacePreferences";
import { PasswordCard } from "./PasswordCard";
import { ProfileClient } from "./ProfileClient";

export const metadata = { title: STRINGS.settings.profile };

// Personal preferences (Pipedrive "My account"): display name + avatar are editable (avatar via
// the presigned-upload handshake); timezone + interface density persist to user_preferences.
export default async function ProfilePage(): Promise<ReactNode> {
  const { actor, session } = await createContext();
  if (actor === null)
    return <p className="text-sm text-destructive">{STRINGS.settings.requiresAuth}</p>;

  const signal = AbortSignal.timeout(5_000);
  const [[me], prefs, credentials] = await Promise.all([
    db
      .select({ name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, actor.id)),
    getPreferencesForActor(db, actor.id),
    getCredentials(db, actor.id, signal),
  ]);

  const hasPassword = credentials?.passwordHash != null;
  const linkSignIn =
    session === null
      ? false
      : await recentLinkSignIn(db, session.sessionId, AbortSignal.timeout(5_000));

  return (
    <SettingsPage>
      <PageTitle title="Profile" />
      <SettingsHeading
        title={STRINGS.settings.profile}
        description={STRINGS.settings.profileDescription}
      />
      <ProfileClient
        name={me?.name ?? ""}
        email={me?.email ?? ""}
        avatarUrl={me?.avatarUrl ?? null}
        timezone={prefs.timezone}
        density={prefs.density}
      />
      {/* Appearance lives in the account menu, where people reach for a theme switch. */}
      <InterfacePreferences
        prefs={interfacePrefsFromUi(prefs.ui)}
        scheduleFollowUpAfterWon={prefs.ui.scheduleFollowUpAfterWon ?? false}
      />
      <DailyActivityTarget target={prefs.ui.dailyActivityTarget ?? DEFAULT_DAILY_ACTIVITY_TARGET} />
      <PasswordCard hasPassword={hasPassword} requiresCurrent={hasPassword && !linkSignIn} />
    </SettingsPage>
  );
}
