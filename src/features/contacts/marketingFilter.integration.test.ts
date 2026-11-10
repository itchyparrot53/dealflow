import { describe, expect, it } from "vitest";
import { personMarketing, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { listPeople } from "./listPeople";
import type { ContactActor } from "./personsRepo";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function adminActor(id: string): ContactActor {
  return {
    id,
    type: "admin",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
    primaryVisibilityGroupId: null,
  };
}

async function seedPerson(db: Db, userId: string, name: string, email: string) {
  const [row] = await db
    .insert(persons)
    .values({ name, primaryEmail: email, ownerId: userId, visibilityLevel: "all" })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

describe("people list marketing status", () => {
  it("filters by marketing status and returns the status on each row", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const subscribed = await seedPerson(db, user.id, "Subscribed Sam", "sam@example.com");
      await seedPerson(db, user.id, "Quiet Quinn", "quinn@example.com");
      await db.insert(personMarketing).values({ personId: subscribed.id, status: "subscribed" });

      const actor = adminActor(user.id);
      const filtered = await listPeople(
        db,
        actor,
        {
          offset: 0,
          limit: 50,
          filter: {
            combinator: "and",
            conditions: [{ field: "marketingStatus", op: "eq", value: "subscribed" }],
          },
        },
        signal,
      );
      expect(filtered.total).toBe(1);
      expect(filtered.rows[0]?.name).toBe("Subscribed Sam");
      expect(filtered.rows[0]?.marketingStatus).toBe("subscribed");

      const all = await listPeople(db, actor, { offset: 0, limit: 50 }, signal);
      expect(all.total).toBe(2);
      expect(all.rows.find((row) => row.name === "Quiet Quinn")?.marketingStatus).toBe(
        "not_subscribed",
      );
    });
  });
});
