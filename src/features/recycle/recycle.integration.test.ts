import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import {
  activities,
  activityTypes,
  changeLogs,
  deals,
  documents,
  domainEvents,
  persons,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { purgeExpired } from "./purgeJob";
import { listDeleted } from "./recycle";
import { restoreItem } from "./restore";

let h: TestDb;
let admin: PermSetUser;
let regular: PermSetUser;
let other: PermSetUser;
let pipelineId: string;
let stageId: string;
let activityTypeId: string;

const sig = (): AbortSignal => AbortSignal.timeout(20_000);
const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function actor(row: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: row.id,
    type: row.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

async function seedPerson(ownerId: string, name: string, deletedAt: Date | null): Promise<string> {
  const [row] = await h.db
    .insert(persons)
    .values({ name, ownerId, visibilityLevel: "all", deletedAt })
    .returning({ id: persons.id });
  if (row === undefined) throw new Error("person seed failed");
  return row.id;
}

async function seedDeal(ownerId: string, title: string, deletedAt: Date | null): Promise<string> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title,
      pipelineId,
      stageId,
      ownerId,
      visibilityLevel: "all",
      boardPosition: "0",
      deletedAt,
    })
    .returning({ id: deals.id });
  if (row === undefined) throw new Error("deal seed failed");
  return row.id;
}

async function seedDeleteLog(entityType: string, entityId: string, actorId: string): Promise<void> {
  await h.db.insert(changeLogs).values({
    entityType,
    entityId,
    field: "deleted",
    oldValue: false,
    newValue: true,
    actorId,
  });
}

beforeAll(async () => {
  h = await makeTestDb();
  admin = actor(await seedUser(h.db, { isAdmin: true, name: "Ada Admin" }));
  regular = actor(await seedUser(h.db, { name: "Rita Regular" }));
  other = actor(await seedUser(h.db, { name: "Otis Other" }));
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
  const [type] = await h.db.select().from(activityTypes).limit(1);
  activityTypeId = type?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

describe("recycle bin listing", () => {
  it("lists only items deleted within the 30-day window", async () => {
    const recent = await seedPerson(admin.id, "Recent delete", daysAgo(29));
    const old = await seedPerson(admin.id, "Old delete", daysAgo(31));
    const rows = await listDeleted(h.db, admin, {}, sig());
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(recent);
    expect(ids).not.toContain(old);
    const row = rows.find((item) => item.id === recent);
    expect(row?.entity).toBe("person");
    expect(row?.daysLeft).toBeGreaterThanOrEqual(1);
  });

  it("shows a regular user only what they own or deleted", async () => {
    const owned = await seedPerson(regular.id, "Rita owns", daysAgo(10));
    const others = await seedPerson(other.id, "Otis owns", daysAgo(10));
    const deletedByRita = await seedPerson(other.id, "Deleted by Rita", daysAgo(10));
    await seedDeleteLog("person", deletedByRita, regular.id);

    const rows = await listDeleted(h.db, regular, { entity: "person" }, sig());
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(owned);
    expect(ids).not.toContain(others);
    expect(ids).toContain(deletedByRita);
    const row = rows.find((item) => item.id === deletedByRita);
    expect(row?.deletedById).toBe(regular.id);
  });

  it("filters by entity and search", async () => {
    await seedPerson(admin.id, "Searchable person", daysAgo(5));
    const rows = await listDeleted(h.db, admin, { entity: "person", search: "Searchable" }, sig());
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.entity === "person")).toBe(true);
    expect(rows.some((row) => row.name === "Searchable person")).toBe(true);
  });
});

describe("restore", () => {
  it("clears deleted_at and writes a change log entry and a domain event", async () => {
    const dealId = await seedDeal(admin.id, "Restore me", daysAgo(5));
    await seedDeleteLog("deal", dealId, admin.id);

    const restored = await restoreItem(h.db, admin, { entity: "deal", id: dealId }, sig());
    expect(restored.ok).toBe(true);

    const [row] = await h.db.select().from(deals).where(eq(deals.id, dealId));
    expect(row?.deletedAt).toBeNull();

    const logs = await h.db
      .select()
      .from(changeLogs)
      .where(
        and(
          eq(changeLogs.entityType, "deal"),
          eq(changeLogs.entityId, dealId),
          eq(changeLogs.field, "deleted"),
        ),
      );
    expect(logs.some((log) => log.newValue === false)).toBe(true);

    const events = await h.db
      .select()
      .from(domainEvents)
      .where(and(eq(domainEvents.type, "deal.updated"), eq(domainEvents.entityId, dealId)));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("refuses to restore an activity whose deal is still deleted", async () => {
    const dealId = await seedDeal(other.id, "Still deleted deal", daysAgo(6));
    const [activity] = await h.db
      .insert(activities)
      .values({
        typeId: activityTypeId,
        subject: "Blocked activity",
        ownerId: other.id,
        assigneeId: other.id,
        dealId,
        deletedAt: daysAgo(6),
      })
      .returning({ id: activities.id });
    if (activity === undefined) throw new Error("activity seed failed");

    const restored = await restoreItem(h.db, admin, { entity: "activity", id: activity.id }, sig());
    expect(restored.ok).toBe(false);
    if (restored.ok) return;
    expect(restored.error.id).toBe(ERROR_IDS.RECYCLE_PARENT_DELETED);
    expect(restored.error.context).toMatchObject({ parent: "deal", parentId: dealId });
  });

  it("refuses an item a user neither owns nor deleted", async () => {
    const personId = await seedPerson(other.id, "Not Rita's", daysAgo(2));
    const restored = await restoreItem(h.db, regular, { entity: "person", id: personId }, sig());
    expect(restored.ok).toBe(false);
    if (restored.ok) return;
    expect(restored.error.id).toBe(ERROR_IDS.RECYCLE_NOT_FOUND);
  });
});

describe("purge", () => {
  it("hard-deletes old items, keeps a deal an invoice references, and ignores recent deletes", async () => {
    const oldPerson = await seedPerson(admin.id, "Purge me", daysAgo(31));
    const recentPerson = await seedPerson(admin.id, "Keep me", daysAgo(29));
    const referencedDeal = await seedDeal(admin.id, "Has an invoice", daysAgo(31));

    await h.db.insert(documents).values({
      kind: "invoice",
      dealId: referencedDeal,
      publicId: `pub-${Math.random().toString(36).slice(2, 12)}`,
      title: "Invoice 1",
      body: "<p>Invoice</p>",
      currency: "USD",
      subtotal: "100.00",
      tax: "0.00",
      total: "100.00",
    });

    const result = await purgeExpired(h.db, sig());
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const people = await h.db.select({ id: persons.id }).from(persons);
    const ids = people.map((row) => row.id);
    expect(ids).not.toContain(oldPerson);
    expect(ids).toContain(recentPerson);

    const dealsLeft = await h.db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.id, referencedDeal));
    expect(dealsLeft).toHaveLength(1);
    expect(
      result.skipped.some((skip) => skip.entity === "deal" && skip.id === referencedDeal),
    ).toBe(true);
  });
});
