import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { env } from "@/config/env";
import { BOOKING_STRINGS } from "@/constants/formsBookingStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listAssignableUsers } from "@/features/identity/users.service";
import { getPage, listActivityTypesForPicker } from "@/features/scheduling/bookingPages";
import type { Availability } from "@/features/scheduling/slots";
import { BookingPageEditor } from "@/features/scheduling/ui/BookingPageEditor";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../../SettingsHeading";
import { SettingsPage } from "../../SettingsSurface";

export const metadata = { title: BOOKING_STRINGS.title };

export default async function BookingPageEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const result = await getPage(db, actor, id, signal);
  if (!result.ok) notFound();
  const page = result.value;

  const [activityTypes, users] = await Promise.all([
    listActivityTypesForPicker(db, signal),
    listAssignableUsers(db, signal),
  ]);
  const isAdmin = actor.type === "admin";

  return (
    <SettingsPage className="max-w-3xl">
      <PageTitle title="Booking pages" />
      <SettingsHeading title={page.title} description={BOOKING_STRINGS.intro} />
      <BookingPageEditor
        baseUrl={env.BASE_URL}
        isAdmin={isAdmin}
        page={{
          id: page.id,
          publicId: page.publicId,
          hostId: page.hostId,
          title: page.title,
          description: page.description,
          durationMinutes: page.durationMinutes,
          bufferMinutes: page.bufferMinutes,
          minNoticeHours: page.minNoticeHours,
          daysAhead: page.daysAhead,
          timezone: page.timezone,
          availability: page.availability as Availability,
          activityTypeId: page.activityTypeId,
          location: page.location,
          active: page.active,
        }}
        lookups={{ activityTypes, users }}
      />
    </SettingsPage>
  );
}
