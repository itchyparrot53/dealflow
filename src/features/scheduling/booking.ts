import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { SLOT_RANGE_MAX_DAYS } from "@/constants/formsBooking";
import type { Db } from "@/db/client";
import { bookingPages, bookings, persons, users } from "@/db/schema";
import { createActivity } from "@/features/activities/repo";
import { loadContactActor } from "@/features/contacts/actorAdapters";
import { createPerson } from "@/features/contacts/personsRepo";
import { emitDomainEvent } from "@/features/events/emit";
import { getPreferences } from "@/features/identity/preferencesRepo";
import { emailBrandHeaderHtml, emailBrandHeaderText } from "@/features/mailer/branding";
import { getSystemMailer } from "@/features/mailer/systemMailer";
import { createNotification } from "@/features/notifications/produce";
import type { PermSetUser } from "@/features/permissions/effective";
import { hydrateActor } from "@/server/hydrateActor";
import { err, ok, type Result } from "@/types/result";
import type { BookingPage } from "./bookingPages";
import { loadBusy } from "./busy";
import { hashCancelToken, newCancelToken } from "./cancelToken";
import { buildIcs } from "./ics";
import { type Availability, computeSlots } from "./slots";
import { addDays, isValidTimeZone, utcToZoned, zonedToUtc } from "./zonedTime";

// Public booking. The reads (page, slots) and the booking write trust only the public id and the
// validated input; the booking is created as the host through the existing services.

export const bookInputSchema = z.object({
  start: z.string().datetime(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  note: z.string().trim().max(1000).nullable().optional(),
  website: z.string().optional(),
});

export type BookInput = z.infer<typeof bookInputSchema>;

export interface PublicBookingPage {
  page: BookingPage;
  host: { id: string; name: string; email: string };
  // The host's profile zone wins (section 3); the page's own zone is the fallback.
  timezone: string;
}

export interface SlotList {
  timezone: string;
  durationMinutes: number;
  slots: string[];
}

export interface BookOutcome {
  start: string;
  end: string;
  hostName: string;
  timezone: string;
  ics: string;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function unavailable(publicId: string): AppError {
  return new AppError(ERROR_IDS.BOOKING_NOT_FOUND, "booking page unavailable", { publicId });
}

function invalidSettings(issues: unknown): AppError {
  return new AppError(ERROR_IDS.BOOKING_INVALID, "booking settings invalid", { issues });
}

export async function loadPublicBookingPage(
  db: Db,
  publicId: string,
  signal: AbortSignal,
): Promise<PublicBookingPage | null> {
  signal.throwIfAborted();
  const [row] = await db
    .select({
      page: bookingPages,
      hostName: users.name,
      hostEmail: users.email,
      hostActive: users.isActive,
    })
    .from(bookingPages)
    .leftJoin(users, eq(users.id, bookingPages.hostId))
    .where(eq(bookingPages.publicId, publicId));
  signal.throwIfAborted();
  if (row === undefined || !row.page.active || row.hostActive !== true) return null;
  const prefs = await getPreferences(db, row.page.hostId, signal);
  const preferred = prefs.timezone;
  const timezone = preferred !== null && isValidTimeZone(preferred) ? preferred : row.page.timezone;
  return {
    page: row.page,
    host: { id: row.page.hostId, name: row.hostName ?? "", email: row.hostEmail ?? "" },
    timezone,
  };
}

function slotPage(loaded: PublicBookingPage) {
  return {
    durationMinutes: loaded.page.durationMinutes,
    bufferMinutes: loaded.page.bufferMinutes,
    minNoticeHours: loaded.page.minNoticeHours,
    daysAhead: loaded.page.daysAhead,
    timezone: loaded.timezone,
    availability: loaded.page.availability as Availability,
  };
}

async function slotsBetween(
  db: Db | Tx,
  loaded: PublicBookingPage,
  from: string,
  to: string,
  now: Date,
  signal: AbortSignal,
): Promise<string[]> {
  const dayStart = zonedToUtc(from, "00:00", loaded.timezone);
  const dayEnd = zonedToUtc(addDays(to, 1), "00:00", loaded.timezone);
  const pad = (loaded.page.bufferMinutes + loaded.page.durationMinutes) * 60_000;
  const busy = await loadBusy(
    db,
    loaded.page.hostId,
    new Date(dayStart.getTime() - pad),
    new Date(dayEnd.getTime() + pad),
    signal,
  );
  return computeSlots(slotPage(loaded), busy, now, from, to);
}

/** Free slots for a window, computed from availability and the host's busy time. */
export async function getSlots(
  db: Db,
  publicId: string,
  from: string,
  to: string,
  now: Date,
  signal: AbortSignal,
): Promise<Result<SlotList, AppError>> {
  const loaded = await loadPublicBookingPage(db, publicId, signal);
  if (loaded === null) return err(unavailable(publicId));
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) {
    return err(invalidSettings(["from and to must be YYYY-MM-DD with from <= to"]));
  }
  if (addDays(from, SLOT_RANGE_MAX_DAYS - 1) < to) {
    return err(invalidSettings([`a window is at most ${SLOT_RANGE_MAX_DAYS} days`]));
  }
  const slots = await slotsBetween(db, loaded, from, to, now, signal);
  return ok({ timezone: loaded.timezone, durationMinutes: loaded.page.durationMinutes, slots });
}

function localLabel(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

async function findOrCreateVisitor(
  db: Db,
  host: PermSetUser,
  input: BookInput,
  signal: AbortSignal,
): Promise<Result<typeof persons.$inferSelect, AppError>> {
  const [existing] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.primaryEmail, input.email), isNull(persons.deletedAt)))
    .limit(1);
  if (existing !== undefined) return ok(existing);

  const contactActor = await loadContactActor(db, host, signal);
  return createPerson(
    db,
    contactActor,
    {
      name: input.name,
      emails: [{ label: "work", value: input.email, primary: true }],
      phones: [],
      orgId: null,
      customFields: {},
    },
    signal,
  );
}

async function notifyHost(
  db: Db,
  hostId: string,
  type: "booking_created" | "booking_cancelled",
  entity: { entityType: "activity" | "person" | null; entityId: string | null },
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<void> {
  const result = await createNotification(
    db,
    {
      recipientId: hostId,
      type,
      entityType: entity.entityType,
      entityId: entity.entityId,
      actorId: null,
      payload,
    },
    signal,
  );
  if (!result.ok) console.warn(`booking notification failed: ${result.error.id}`);
}

async function sendVisitorEmail(
  to: string,
  subject: string,
  text: string,
  signal: AbortSignal,
): Promise<void> {
  const mailer = getSystemMailer();
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const result = await mailer.send(
    {
      to,
      subject,
      text: `${emailBrandHeaderText()}${text}`,
      html: `${emailBrandHeaderHtml()}<pre>${escaped}</pre>`,
    },
    signal,
  );
  if (!result.ok) console.warn(`booking confirmation email failed: ${result.error.id}`);
}

export async function bookSlot(
  db: Db,
  publicId: string,
  raw: unknown,
  now: Date,
  signal: AbortSignal,
): Promise<Result<BookOutcome | null, AppError>> {
  const parsed = bookInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.BOOKING_INPUT_INVALID, "booking input invalid", {
        issues: parsed.error.issues,
      }),
    );
  }
  const input = parsed.data;
  const loaded = await loadPublicBookingPage(db, publicId, signal);
  if (loaded === null) return err(unavailable(publicId));
  // A filled honeypot is accepted silently, exactly like the form path.
  if ((input.website ?? "").trim() !== "") return ok(null);

  const { page, host, timezone } = loaded;
  const start = new Date(input.start);
  const localDate = utcToZoned(start, timezone).date;
  const hostActor = await hydrateActor(db, page.hostId, signal);
  if (hostActor === null) return err(unavailable(publicId));

  const cancelToken = newCancelToken();
  const duration = page.durationMinutes;

  let created: { bookingId: string; activityId: string; end: Date };
  try {
    created = await db.transaction(async (tx) => {
      // One lock per host serialises the re-check and the insert, so two visitors cannot both
      // pass the slot check for the same time.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${page.hostId}`}))`);

      const visitor = await findOrCreateVisitor(tx, hostActor, input, signal);
      if (!visitor.ok) throw visitor.error;

      const slots = await slotsBetween(tx, loaded, localDate, localDate, now, signal);
      if (!slots.includes(start.toISOString())) {
        throw new AppError(ERROR_IDS.BOOKING_SLOT_TAKEN, "slot no longer free", {
          start: input.start,
        });
      }
      const end = new Date(start.getTime() + duration * 60_000);

      const activity = await createActivity(
        tx,
        hostActor,
        {
          typeId: page.activityTypeId,
          subject: `${page.title} with ${input.name}`.slice(0, 255),
          dueAt: start.toISOString(),
          endAt: end.toISOString(),
          durationMinutes: duration,
          assigneeId: page.hostId,
          personId: visitor.value.id,
          note: input.note ?? null,
          location: page.location,
        },
        signal,
      );
      if (!activity.ok) throw activity.error;

      const [booking] = await tx
        .insert(bookings)
        .values({
          pageId: page.id,
          activityId: activity.value.id,
          personId: visitor.value.id,
          startAt: start,
          endAt: end,
          visitorName: input.name,
          visitorEmail: input.email,
          note: input.note ?? null,
          cancelTokenHash: hashCancelToken(cancelToken),
          status: "booked",
        })
        .returning({ id: bookings.id });
      if (booking === undefined) {
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "booking insert returned no row");
      }

      await emitDomainEvent(
        tx,
        {
          type: "booking.created",
          entityType: "activity",
          entityId: activity.value.id,
          actorId: page.hostId,
          changes: [{ field: "booking", old: null, new: booking.id }],
        },
        signal,
      );
      return { bookingId: booking.id, activityId: activity.value.id, end };
    });
  } catch (error) {
    if (error instanceof AppError) return err(error);
    throw error;
  }

  await notifyHost(
    db,
    page.hostId,
    "booking_created",
    { entityType: "activity", entityId: created.activityId },
    {
      bookingId: created.bookingId,
      pageTitle: page.title,
      name: input.name,
      email: input.email,
      start: start.toISOString(),
    },
    signal,
  );

  const when = localLabel(start, timezone);
  const cancelUrl = `${env.BASE_URL}/book/cancel/${cancelToken}`;
  const emailText = [
    `Hi ${input.name},`,
    "",
    `Your booking with ${host.name} is confirmed.`,
    "",
    `${when} (${timezone})`,
    `${duration} minutes`,
    ...(page.location === null ? [] : [page.location]),
    "",
    `Need to cancel? ${cancelUrl}`,
    "",
    "Thanks,",
    "Dealflow",
  ].join("\n");
  await sendVisitorEmail(input.email, `Booked: ${page.title} with ${host.name}`, emailText, signal);

  return ok({
    start: start.toISOString(),
    end: created.end.toISOString(),
    hostName: host.name,
    timezone,
    ics: buildIcs({
      uid: `booking-${created.bookingId}@dealflow`,
      start,
      end: created.end,
      summary: `${page.title} with ${host.name}`,
      description: page.description ?? "",
      location: page.location ?? "",
      organizerName: host.name,
      organizerEmail: host.email,
    }),
  });
}
