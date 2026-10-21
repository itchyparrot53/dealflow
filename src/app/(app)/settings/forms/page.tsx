import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { env } from "@/config/env";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { listForms } from "@/features/forms/forms";
import { FormsList } from "@/features/forms/ui/FormsList";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: FORMS_STRINGS.title };

// Settings > Forms. Admin only; the nav hides the link, and this gate is the boundary.
export default async function FormsSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (!can(actor, "forms.manage")) {
    return <p className="text-sm text-destructive">{FORMS_STRINGS.adminOnly}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const [rows, userRows] = await Promise.all([
    listForms(db, signal),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)),
  ]);
  const names = new Map(userRows.map((row) => [row.id, row.name]));

  return (
    <SettingsPage className="max-w-5xl">
      <SettingsHeading title={FORMS_STRINGS.title} description={FORMS_STRINGS.intro} />
      <FormsList
        currentUserId={actor.id}
        baseUrl={env.BASE_URL}
        rows={rows.map((row) => ({
          id: row.id,
          publicId: row.publicId,
          name: row.name,
          creates: row.creates === "deal" ? "deal" : "lead",
          ownerName: names.get(row.ownerId) ?? row.ownerId,
          submissionCount: row.submissionCount,
          active: row.active,
        }))}
      />
    </SettingsPage>
  );
}
