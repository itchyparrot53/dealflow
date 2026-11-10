import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { consentEvents, personMarketing, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { bulkChangeMarketingStatus, MARKETING_BULK_MAX } from "./bulk";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function actorOf(id: string, flags: string[]): PermSetUser {
  return {
    id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(flags) as PermSetUser["flags"],
  };
}

async function seedPerson(db: Db, ownerId: string, email: string) {
  const [row] = await db
    .insert(persons)
    .values({ name: email, primaryEmail: email, ownerId, visibilityLevel: "all" })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

describe("bulk marketing status", () => {
  it("subscribes the selection with one consent event each", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const one = await seedPerson(db, user.id, "one@example.com");
      const two = await seedPerson(db, user.id, "two@example.com");

      const result = await bulkChangeMarketingStatus(
        db,
        actorOf(user.id, ["marketing.manage"]),
        { personIds: [one.id, two.id], to: "subscribed", basis: "explicit" },
        signal,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.applied).toBe(2);

      const marketing = await db.select().from(personMarketing);
      expect(marketing).toHaveLength(2);
      expect(marketing.every((row) => row.status === "subscribed")).toBe(true);
      const events = await db.select().from(consentEvents).where(eq(consentEvents.source, "bulk"));
      expect(events).toHaveLength(2);
    });
  });

  it("requires marketing.manage", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const person = await seedPerson(db, user.id, "no@example.com");
      const result = await bulkChangeMarketingStatus(
        db,
        actorOf(user.id, []),
        { personIds: [person.id], to: "unsubscribed" },
        signal,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_PERM_001");
    });
  });

  it("refuses more than the 5,000 cap before touching the database", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const ids = Array.from({ length: MARKETING_BULK_MAX + 1 }, () => randomUUID());
      const result = await bulkChangeMarketingStatus(
        db,
        actorOf(user.id, ["marketing.manage"]),
        { personIds: ids, to: "unsubscribed" },
        signal,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_BULK_001");
    });
  });
});
