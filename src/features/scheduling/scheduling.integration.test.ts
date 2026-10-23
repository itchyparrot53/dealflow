import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POST as bookRoute,
  resetBookRateLimitForTest,
} from "@/app/api/public/booking/[publicId]/book/route";
import {
  activities,
  activityTypes,
  bookingPages,
  bookings,
  domainEvents,
  notifications,
  persons,
} from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import { setSystemMailerForTest } from "@/features/mailer/systemMailer";
import type { SystemMail } from "@/features/mailer/types";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { publicJsonHeaders } from "@/test/publicRequest";
import { ok } from "@/types/result";
import { bookSlot, getSlots } from "./booking";
import { type BookingPage, createPage, setPageActive } from "./bookingPages";
import { cancelBooking } from "./cancel";
import type { Availability } from "./slots";
import { addDays, utcToZoned } from "./zonedTime";

// The public route binds the app's shared pool when it is imported, so the test points that
// binding at its per-test database instead. It is still a real Drizzle client over real Postgres
// (Testcontainers); only the connection string is swapped.
let h: TestDb;
vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

let host: PermSetUser;
let hostId: string;
let activityTypeId: string;

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

const EVERY_DAY: Availability = {
  mon: [{ from: "09:00", to: "17:00" }],
  tue: [{ from: "09:00", to: "17:00" }],
  wed: [{ from: "09:00", to: "17:00" }],
  thu: [{ from: "09:00", to: "17:00" }],
  fri: [{ from: "09:00", to: "17:00" }],
  sat: [{ from: "09:00", to: "17:00" }],
  sun: [{ from: "09:00", to: "17:00" }],
};

const captured: SystemMail[] = [];

beforeAll(async () => {
  h = await makeTestDb();
  const row = await seedUser(h.db, { isAdmin: true, name: "Ada Host" });
  hostId = row.id;
  host = { id: row.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };

  const [seededType] = await h.db.select().from(activityTypes).limit(1);
  if (seededType !== undefined) {
    activityTypeId = seededType.id;
  } else {
    const [created] = await h.db
      .insert(activityTypes)
      .values({ key: "meeting", name: "Meeting", order: 0 })
      .returning();
    activityTypeId = created?.id ?? "";
  }

  setSystemMailerForTest({
    mode: "capture",
    send: (mail) => {
      captured.push(mail);
      return Promise.resolve(ok({ messageId: "captured" }));
    },
  });
}, 60_000);

afterAll(async () => {
  setSystemMailerForTest(null);
  await h.close();
});

beforeEach(async () => {
  captured.length = 0;
  await h.db.delete(bookings);
  await h.db.delete(activities);
  await h.db.delete(bookingPages);
  await h.db.delete(notifications);
  await h.db.delete(domainEvents);
  await h.db.delete(persons);
  resetBookRateLimitForTest();
});

// A slot three days out is inside the 30-day window but outside any notice period under test.
function testDay(): string {
  return addDays(utcToZoned(new Date(), "UTC").date, 3);
}

function startAt(day: string, time: string): Date {
  return new Date(`${day}T${time}:00.000Z`);
}

async function seedPage(over: Record<string, unknown> = {}): Promise<BookingPage> {
  const result = await createPage(
    h.db,
    host,
    {
      title: "Discovery call",
      timezone: "UTC",
      durationMinutes: 30,
      bufferMinutes: 0,
      minNoticeHours: 0,
      daysAhead: 30,
      availability: EVERY_DAY,
      ...over,
    },
    sig(),
  );
  if (!result.ok) throw new Error(`createPage failed: ${result.error.id}`);
  return result.value;
}

async function insertActivity(over: Record<string, unknown> = {}): Promise<string> {
  const [row] = await h.db
    .insert(activities)
    .values({
      typeId: activityTypeId,
      subject: "Busy",
      ownerId: hostId,
      assigneeId: hostId,
      durationMinutes: 30,
      ...over,
    })
    .returning({ id: activities.id });
  if (row === undefined) throw new Error("activity insert failed");
  return row.id;
}

function tokenFromMail(): string {
  const mail = captured.find((entry) => entry.text.includes("/book/cancel/"));
  if (mail === undefined) throw new Error("no confirmation email captured");
  const match = /\/book\/cancel\/([A-Za-z0-9_-]+)/.exec(mail.text);
  if (match === null || match[1] === undefined) throw new Error("no cancel link in email");
  return match[1];
}

describe("public availability", () => {
  it("excludes a timed activity of the host but not an all-day one", async () => {
    const page = await seedPage();
    const day = testDay();

    const before = await getSlots(h.db, page.publicId, day, day, new Date(), sig());
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.slots).toContain(startAt(day, "09:00").toISOString());

    await insertActivity({
      dueAt: startAt(day, "09:00"),
      endAt: startAt(day, "09:30"),
      durationMinutes: null,
    });

    const after = await getSlots(h.db, page.publicId, day, day, new Date(), sig());
    if (!after.ok) throw new Error(after.error.id);
    expect(after.value.slots).not.toContain(startAt(day, "09:00").toISOString());
    expect(after.value.slots).toContain(startAt(day, "09:30").toISOString());

    // An all-day row must not block any slot.
    await insertActivity({
      dueAt: startAt(day, "09:00"),
      allDay: true,
      durationMinutes: 600,
    });
    const withAllDay = await getSlots(h.db, page.publicId, day, day, new Date(), sig());
    if (!withAllDay.ok) throw new Error(withAllDay.error.id);
    expect(withAllDay.value.slots).toContain(startAt(day, "10:00").toISOString());
  });
});

describe("booking", () => {
  it("creates the activity, links the person, notifies the host and emails the visitor", async () => {
    const page = await seedPage();
    const day = testDay();
    const start = startAt(day, "09:00");

    const result = await bookSlot(
      h.db,
      page.publicId,
      {
        start: start.toISOString(),
        name: "Sam Ortiz",
        email: "sam.ortiz@example.com",
        note: "Intro",
      },
      new Date(),
      sig(),
    );
    if (!result.ok) throw new Error(result.error.id);
    expect(result.value).not.toBeNull();

    const [activityRow] = await h.db.select().from(activities);
    expect(activityRow?.subject).toBe("Discovery call with Sam Ortiz");
    expect(activityRow?.dueAt?.toISOString()).toBe(start.toISOString());
    expect(activityRow?.endAt?.toISOString()).toBe(
      new Date(start.getTime() + 30 * 60_000).toISOString(),
    );
    expect(activityRow?.durationMinutes).toBe(30);
    expect(activityRow?.assigneeId).toBe(hostId);
    expect(activityRow?.personId).not.toBeNull();

    const people = await h.db.select().from(persons);
    expect(people).toHaveLength(1);
    expect(people[0]?.primaryEmail).toBe("sam.ortiz@example.com");

    const bookingRows = await h.db.select().from(bookings);
    expect(bookingRows).toHaveLength(1);
    expect(bookingRows[0]?.status).toBe("booked");
    expect(bookingRows[0]?.activityId).toBe(activityRow?.id);

    const events = await h.db.select().from(domainEvents);
    expect(events.map((event) => event.type)).toContain("booking.created");

    const notifs = await h.db.select().from(notifications);
    expect(notifs.some((n) => n.type === "booking_created" && n.userId === hostId)).toBe(true);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.to).toBe("sam.ortiz@example.com");
    expect(captured[0]?.text).toContain("/book/cancel/");
    expect(captured[0]?.text.startsWith("Dealflow\n\n")).toBe(true);
    expect(captured[0]?.html).toContain('data-df-layout="customer-branded"');
    expect(captured[0]?.attachments?.[0]?.filename).toBe("invite.ics");
  });

  it("lets exactly one of ten concurrent bookings win", async () => {
    const page = await seedPage();
    const day = testDay();
    const start = startAt(day, "11:00").toISOString();

    // Warm the pool so the ten calls do not queue on connection establishment.
    await Promise.all(Array.from({ length: 4 }, () => h.db.execute(sql`select 1`)));

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        bookSlot(
          h.db,
          page.publicId,
          { start, name: `Visitor ${index}`, email: `visitor${index}@example.com` },
          new Date(),
          sig(),
        ),
      ),
    );

    const successes = results.filter((result) => result.ok && result.value !== null);
    const taken = results.filter((result) => !result.ok && result.error.id === "E_BOOKING_002");
    expect(successes).toHaveLength(1);
    expect(taken).toHaveLength(9);
    expect(await h.db.select().from(bookings)).toHaveLength(1);
  });

  it("refuses a slot inside the notice window", async () => {
    const page = await seedPage({ minNoticeHours: 24 });
    // Today at 09:00 is always inside a 24-hour notice window (and in the past after 09:00 UTC).
    const day = utcToZoned(new Date(), "UTC").date;
    const start = startAt(day, "09:00").toISOString();
    const result = await bookSlot(
      h.db,
      page.publicId,
      { start, name: "Sam Ortiz", email: "sam@example.com" },
      new Date(),
      sig(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe("E_BOOKING_002");
  });

  it("answers 404 for an inactive page", async () => {
    const page = await seedPage();
    await setPageActive(h.db, host, page.id, false, sig());
    const day = testDay();
    const slots = await getSlots(h.db, page.publicId, day, day, new Date(), sig());
    expect(slots.ok).toBe(false);
    const booked = await bookSlot(
      h.db,
      page.publicId,
      { start: startAt(day, "09:00").toISOString(), name: "Sam", email: "sam@example.com" },
      new Date(),
      sig(),
    );
    expect(booked.ok).toBe(false);
    if (!booked.ok) expect(booked.error.id).toBe("E_BOOKING_001");
  });

  it("answers 429 on the eleventh booking request in a minute", async () => {
    const page = await seedPage();
    const day = testDay();
    const start = startAt(day, "15:00").toISOString();
    let last: Response | null = null;
    for (let i = 0; i < 11; i += 1) {
      const request = new NextRequest(`http://localhost/api/public/booking/${page.publicId}/book`, {
        method: "POST",
        headers: publicJsonHeaders("198.51.100.9"),
        body: JSON.stringify({ start, name: `Visitor ${i}`, email: `v${i}@example.com` }),
      });
      last = await bookRoute(request, { params: Promise.resolve({ publicId: page.publicId }) });
    }
    expect(last?.status).toBe(429);
  });
});

describe("cancel", () => {
  it("removes the activity, marks the booking cancelled and refuses a second cancel", async () => {
    const page = await seedPage();
    const day = testDay();
    const start = startAt(day, "13:00");
    const booked = await bookSlot(
      h.db,
      page.publicId,
      { start: start.toISOString(), name: "Sam Ortiz", email: "sam.ortiz@example.com" },
      new Date(),
      sig(),
    );
    if (!booked.ok) throw new Error(booked.error.id);
    const token = tokenFromMail();

    const first = await cancelBooking(h.db, token, new Date(), sig());
    expect(first.ok).toBe(true);

    const [activityRow] = await h.db.select().from(activities);
    expect(activityRow?.deletedAt).not.toBeNull();
    const [bookingRow] = await h.db.select().from(bookings);
    expect(bookingRow?.status).toBe("cancelled");
    expect(bookingRow?.cancelledAt).not.toBeNull();

    const events = await h.db.select().from(domainEvents);
    expect(events.map((event) => event.type)).toContain("booking.cancelled");

    const second = await cancelBooking(h.db, token, new Date(), sig());
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.id).toBe("E_BOOKING_005");
  });
});
