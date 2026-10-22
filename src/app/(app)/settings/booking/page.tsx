import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { env } from "@/config/env";
import { BOOKING_STRINGS } from "@/constants/formsBookingStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listAllPages, listMyPages } from "@/features/scheduling/bookingPages";
import { BookingPagesList } from "@/features/scheduling/ui/BookingPagesList";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: BOOKING_STRINGS.title };

// Settings > Booking pages. Every signed-in user manages their own; an admin sees every page and
// the host column. The service enforces the same rule, so the page gate is presentation only.
export default async function BookingSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const isAdmin = actor.type === "admin";
  const rows = isAdmin ? await listAllPages(db, actor, signal) : null;
  const pages = rows === null || !rows.ok ? await listMyPages(db, actor, signal) : rows.value;

  return (
    <SettingsPage className="max-w-5xl">
      <PageTitle title="Booking pages" />
      <SettingsHeading title={BOOKING_STRINGS.title} description={BOOKING_STRINGS.intro} />
      <BookingPagesList
        baseUrl={env.BASE_URL}
        showHost={isAdmin}
        rows={pages.map((page) => ({
          id: page.id,
          publicId: page.publicId,
          title: page.title,
          hostName: page.hostName ?? actor.id,
          durationMinutes: page.durationMinutes,
          active: page.active,
        }))}
      />
    </SettingsPage>
  );
}
