import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { activities, bookingPages, bookings, users } from "@/db/schema";
import { emitDomainEvent } from "@/features/events/emit";
import { getPreferences } from "@/features/identity/preferencesRepo";
import { createNotification } from "@/features/notifications/produce";
import { err, ok, type Result } from "@/types/result";
import { hashCancelToken } from "./cancelToken";
import { isValidTimeZone } from "./zonedTime";

// Cancel by link. The token is the only credential: it is looked up by its hash, consumed in the
// same statement that flips the status, and a second use finds nothing to cancel.

export interface CancelInfo {
  bookingId: string;
  pageId: string;
  hostId: string;
  personId: string | null;
  hostName: string;
  pageTitle: string;
  visitorName: string;
  visitorEmail: string;
  startAt: Date;
  endAt: Date;
  status: string;
  timezone: string;
}

interface BookingRow {
  booking: typeof bookings.$inferSelect;
  page: typeof bookingPages.$inferSelect;
  hostName: string | null;
}

async function findByToken(db: Db, token: string): Promise<BookingRow | null> {
  const [row] = await db
    .select({ booking: bookings, page: bookingPages, hostName: users.name })
    .from(bookings)
    .innerJoin(bookingPages, eq(bookingPages.id, bookings.pageId))
    .leftJoin(users, eq(users.id, bookingPages.hostId))
    .where(eq(bookings.cancelTokenHash, hashCancelToken(token)));
  return row ?? null;
}

async function effectiveTimezone(db: Db, row: BookingRow, signal: AbortSignal): Promise<string> {
  const prefs = await getPreferences(db, row.page.hostId, signal);
  const preferred = prefs.timezone;
  return preferred !== null && isValidTimeZone(preferred) ? preferred : row.page.timezone;
}

/** The booking behind a cancel link, for the confirmation page. Null when the link is unknown. */
export async function loadBookingByToken(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<CancelInfo | null> {
  signal.throwIfAborted();
  const row = await findByToken(db, token);
  if (row === null) return null;
  return {
    bookingId: row.booking.id,
    pageId: row.page.id,
    hostId: row.page.hostId,
    personId: row.booking.personId,
    hostName: row.hostName ?? "",
    pageTitle: row.page.title,
    visitorName: row.booking.visitorName,
    visitorEmail: row.booking.visitorEmail,
    startAt: row.booking.startAt,
    endAt: row.booking.endAt,
    status: row.booking.status,
    timezone: await effectiveTimezone(db, row, signal),
  };
}

function invalidLink(): AppError {
  return new AppError(ERROR_IDS.BOOKING_CANCEL_INVALID, "cancel link invalid or already used");
}

export async function cancelBooking(
  db: Db,
  token: string,
  now: Date,
  signal: AbortSignal,
): Promise<Result<CancelInfo, AppError>> {
  const existing = await loadBookingByToken(db, token, signal);
  if (existing === null || existing.status !== "booked") return err(invalidLink());

  let info: CancelInfo;
  try {
    info = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ booking: bookings, page: bookingPages, hostName: users.name })
        .from(bookings)
        .innerJoin(bookingPages, eq(bookingPages.id, bookings.pageId))
        .leftJoin(users, eq(users.id, bookingPages.hostId))
        .where(eq(bookings.cancelTokenHash, hashCancelToken(token)))
        .for("update");
      if (row === undefined || row.booking.status !== "booked") throw invalidLink();

      await tx
        .update(bookings)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(bookings.id, row.booking.id));

      // The cancel link is authority the host handed the visitor by publishing the page, so the
      // host's own activity.delete flag must not block it; the activity is soft-deleted directly.
      if (row.booking.activityId !== null) {
        await tx
          .update(activities)
          .set({ deletedAt: now })
          .where(eq(activities.id, row.booking.activityId));
      }

      const entityType = row.booking.personId === null ? "activity" : "person";
      const entityId = row.booking.personId ?? row.booking.activityId;
      if (entityId !== null) {
        await emitDomainEvent(
          tx,
          {
            type: "booking.cancelled",
            entityType,
            entityId,
            actorId: row.page.hostId,
            changes: [{ field: "booking", old: null, new: row.booking.id }],
          },
          signal,
        );
      }

      return {
        bookingId: row.booking.id,
        pageId: row.page.id,
        hostId: row.page.hostId,
        personId: row.booking.personId,
        hostName: row.hostName ?? "",
        pageTitle: row.page.title,
        visitorName: row.booking.visitorName,
        visitorEmail: row.booking.visitorEmail,
        startAt: row.booking.startAt,
        endAt: row.booking.endAt,
        status: "cancelled",
        timezone: await effectiveTimezone(tx, row, signal),
      };
    });
  } catch (error) {
    if (error instanceof AppError) return err(error);
    throw error;
  }

  const notified = await createNotification(
    db,
    {
      recipientId: info.hostId,
      type: "booking_cancelled",
      // A cancellation is the visitor's, not the host's, so the person is the only safe parent.
      entityType: info.personId === null ? null : "person",
      entityId: info.personId,
      actorId: null,
      payload: {
        pageTitle: info.pageTitle,
        name: info.visitorName,
        start: info.startAt.toISOString(),
      },
    },
    signal,
  );
  if (!notified.ok) console.warn(`booking cancellation notification failed: ${notified.error.id}`);

  return ok(info);
}
