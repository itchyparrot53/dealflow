import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { loadPublicBookingPage } from "@/features/scheduling/booking";
import { PublicBooking } from "@/features/scheduling/ui/PublicBooking";

// The public booking page. It is rendered outside the app shell, may be framed on any site, and
// shows free times in the visitor's own time zone.

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const loaded = await loadPublicBookingPage(db, publicId, AbortSignal.timeout(5000));
  return { title: loaded?.page.title ?? "Booking page not available" };
}

export default async function PublicBookingPageRoute({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<React.ReactNode> {
  const { publicId } = await params;
  const loaded = await loadPublicBookingPage(db, publicId, AbortSignal.timeout(5000));
  if (loaded === null) notFound();

  return (
    <PublicBooking
      publicId={publicId}
      title={loaded.page.title}
      description={loaded.page.description}
      hostName={loaded.host.name}
      durationMinutes={loaded.page.durationMinutes}
      location={loaded.page.location}
      pageTimezone={loaded.timezone}
    />
  );
}
