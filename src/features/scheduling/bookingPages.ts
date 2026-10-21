import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { BOOKING_DEFAULT_DURATION } from "@/constants/formsBooking";
import type { Db } from "@/db/client";
import { activityTypes, bookingPages, users } from "@/db/schema";
import { getPreferences as getUserPreferences } from "@/features/identity/preferencesRepo";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { availabilitySchema, DEFAULT_AVAILABILITY } from "./slots";
import { isValidTimeZone } from "./zonedTime";

// Booking-page CRUD and the owner-or-admin rule. Any signed-in user manages their own pages;
// admins manage every page. The public side lives in booking.ts and never takes an actor.

export type BookingPage = typeof bookingPages.$inferSelect;

const idSchema = z.string().uuid();

export const bookingPageInputSchema = z.object({
  hostId: idSchema.optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  minNoticeHours: z.number().int().min(0).max(168).optional(),
  daysAhead: z.number().int().min(1).max(90).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  availability: availabilitySchema.optional(),
  activityTypeId: idSchema.optional(),
  location: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().optional(),
});

export const bookingPagePatchSchema = bookingPageInputSchema.partial();

function denied(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "booking page owner or admin required", {
    userId: actor.id,
  });
}

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.BOOKING_NOT_FOUND, "Booking page not found", { pageId: id });
}

function invalidInput(issues: unknown): AppError {
  return new AppError(ERROR_IDS.BOOKING_INPUT_INVALID, "booking page input invalid", { issues });
}

function invalidPage(issues: unknown): AppError {
  return new AppError(ERROR_IDS.BOOKING_INVALID, "booking page settings invalid", { issues });
}

export function canManagePage(actor: PermSetUser, page: BookingPage): boolean {
  return actor.type === "admin" || page.hostId === actor.id;
}

export function newBookingPublicId(): string {
  return randomBytes(12).toString("base64url");
}

export async function listMyPages(
  db: DbOrTx,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<(BookingPage & { hostName: string | null })[]> {
  signal.throwIfAborted();
  const rows = await db
    .select({ page: bookingPages, hostName: users.name })
    .from(bookingPages)
    .leftJoin(users, eq(users.id, bookingPages.hostId))
    .where(eq(bookingPages.hostId, actor.id))
    .orderBy(asc(bookingPages.title));
  signal.throwIfAborted();
  return rows.map((row) => ({ ...row.page, hostName: row.hostName }));
}

export async function listAllPages(
  db: DbOrTx,
  actor: PermSetUser,
  signal: AbortSignal,
): Promise<Result<(BookingPage & { hostName: string | null })[], AppError>> {
  if (actor.type !== "admin") {
    return err(new AppError(ERROR_IDS.PERM_DENIED, "admin required", { userId: actor.id }));
  }
  signal.throwIfAborted();
  const rows = await db
    .select({ page: bookingPages, hostName: users.name })
    .from(bookingPages)
    .leftJoin(users, eq(users.id, bookingPages.hostId))
    .orderBy(asc(bookingPages.title));
  signal.throwIfAborted();
  return ok(rows.map((row) => ({ ...row.page, hostName: row.hostName })));
}

export async function getPage(
  db: DbOrTx,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<BookingPage, AppError>> {
  signal.throwIfAborted();
  const [row] = await db.select().from(bookingPages).where(eq(bookingPages.id, id));
  if (row === undefined) return err(notFound(id));
  if (!canManagePage(actor, row)) return err(denied(actor));
  return ok(row);
}

async function defaultTimezone(
  db: Db,
  hostId: string,
  requested: string | undefined,
  signal: AbortSignal,
): Promise<string> {
  if (requested !== undefined) return requested;
  const prefs = await getUserPreferences(db, hostId, signal);
  const preferred = prefs.timezone;
  // A stored preference is a non-empty string, not necessarily a zone this runtime knows.
  return preferred !== null && isValidTimeZone(preferred) ? preferred : "UTC";
}

async function defaultActivityTypeId(db: Db, signal: AbortSignal): Promise<string | null> {
  signal.throwIfAborted();
  const active = isNull(activityTypes.archivedAt);
  const [meeting] = await db
    .select({ id: activityTypes.id })
    .from(activityTypes)
    .where(and(active, sql`lower(${activityTypes.name}) = 'meeting'`))
    .orderBy(asc(activityTypes.order))
    .limit(1);
  if (meeting !== undefined) return meeting.id;
  const [first] = await db
    .select({ id: activityTypes.id })
    .from(activityTypes)
    .where(active)
    .orderBy(asc(activityTypes.order))
    .limit(1);
  return first?.id ?? null;
}

async function assertActiveHost(db: Db, hostId: string, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, hostId), eq(users.isActive, true)));
  return row !== undefined;
}

export async function createPage(
  db: Db,
  actor: PermSetUser,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<BookingPage, AppError>> {
  const parsed = bookingPageInputSchema.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  const hostId = parsed.data.hostId ?? actor.id;
  if (actor.type !== "admin" && hostId !== actor.id) return err(denied(actor));
  if (!(await assertActiveHost(db, hostId, signal))) {
    return err(invalidPage(["host is not an active user"]));
  }

  const timezone = await defaultTimezone(db, hostId, parsed.data.timezone, signal);
  if (!isValidTimeZone(timezone)) return err(invalidPage(["unknown time zone"]));

  const activityTypeId = parsed.data.activityTypeId ?? (await defaultActivityTypeId(db, signal));
  if (activityTypeId === null) return err(invalidPage(["no activity type available"]));

  signal.throwIfAborted();
  const [row] = await db
    .insert(bookingPages)
    .values({
      publicId: newBookingPublicId(),
      hostId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      durationMinutes: parsed.data.durationMinutes ?? BOOKING_DEFAULT_DURATION,
      bufferMinutes: parsed.data.bufferMinutes ?? 0,
      minNoticeHours: parsed.data.minNoticeHours ?? 4,
      daysAhead: parsed.data.daysAhead ?? 30,
      timezone,
      availability: parsed.data.availability ?? DEFAULT_AVAILABILITY,
      activityTypeId,
      location: parsed.data.location ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();
  if (row === undefined) return err(notFound("new"));
  return ok(row);
}

type PagePatch = z.infer<typeof bookingPagePatchSchema>;

// Only the columns the patch actually named are written; an omitted field keeps its value.
function patchColumns(patch: PagePatch): Partial<typeof bookingPages.$inferInsert> {
  const set: Partial<typeof bookingPages.$inferInsert> = {};
  if (patch.hostId !== undefined) set.hostId = patch.hostId;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.durationMinutes !== undefined) set.durationMinutes = patch.durationMinutes;
  if (patch.bufferMinutes !== undefined) set.bufferMinutes = patch.bufferMinutes;
  if (patch.minNoticeHours !== undefined) set.minNoticeHours = patch.minNoticeHours;
  if (patch.daysAhead !== undefined) set.daysAhead = patch.daysAhead;
  if (patch.timezone !== undefined) set.timezone = patch.timezone;
  if (patch.availability !== undefined) set.availability = patch.availability;
  if (patch.activityTypeId !== undefined) set.activityTypeId = patch.activityTypeId;
  if (patch.location !== undefined) set.location = patch.location;
  if (patch.active !== undefined) set.active = patch.active;
  return set;
}

export async function updatePage(
  db: Db,
  actor: PermSetUser,
  id: string,
  input: unknown,
  signal: AbortSignal,
): Promise<Result<BookingPage, AppError>> {
  const parsed = bookingPagePatchSchema.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));

  const existing = await getPage(db, actor, id, signal);
  if (!existing.ok) return existing;
  const page = existing.value;

  // Only an admin may hand a page to another host; the host id is otherwise fixed at creation.
  if (parsed.data.hostId !== undefined && parsed.data.hostId !== page.hostId) {
    if (actor.type !== "admin") return err(denied(actor));
    if (!(await assertActiveHost(db, parsed.data.hostId, signal))) {
      return err(invalidPage(["host is not an active user"]));
    }
  }
  if (parsed.data.timezone !== undefined && !isValidTimeZone(parsed.data.timezone)) {
    return err(invalidPage(["unknown time zone"]));
  }

  signal.throwIfAborted();
  const [row] = await db
    .update(bookingPages)
    .set({ ...patchColumns(parsed.data), updatedAt: new Date() })
    .where(eq(bookingPages.id, id))
    .returning();
  if (row === undefined) return err(notFound(id));
  return ok(row);
}

export async function setPageActive(
  db: Db,
  actor: PermSetUser,
  id: string,
  active: boolean,
  signal: AbortSignal,
): Promise<Result<BookingPage, AppError>> {
  return updatePage(db, actor, id, { active }, signal);
}

export async function deletePage(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  const existing = await getPage(db, actor, id, signal);
  if (!existing.ok) return existing;
  signal.throwIfAborted();
  const [row] = await db
    .delete(bookingPages)
    .where(eq(bookingPages.id, id))
    .returning({ id: bookingPages.id });
  if (row === undefined) return err(notFound(id));
  return ok(undefined);
}

/** Active activity types for the editor's picker. */
export async function listActivityTypesForPicker(
  db: DbOrTx,
  signal: AbortSignal,
): Promise<{ id: string; name: string }[]> {
  signal.throwIfAborted();
  return db
    .select({ id: activityTypes.id, name: activityTypes.name })
    .from(activityTypes)
    .where(isNull(activityTypes.archivedAt))
    .orderBy(asc(activityTypes.order));
}
