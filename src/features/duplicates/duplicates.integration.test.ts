import { describe, expect, it } from "vitest";
import { organizations, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { dismissPair } from "./dismiss";
import { findDuplicatePairs } from "./find";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function actorOf(user: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: user.id,
    type: user.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

async function person(
  db: Db,
  ownerId: string,
  overrides: Partial<typeof persons.$inferInsert> = {},
): Promise<typeof persons.$inferSelect> {
  const [row] = await db
    .insert(persons)
    .values({
      name: "Jane Doe",
      ownerId,
      visibilityLevel: "all",
      ...overrides,
    })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

async function org(
  db: Db,
  ownerId: string,
  overrides: Partial<typeof organizations.$inferInsert> = {},
): Promise<typeof organizations.$inferSelect> {
  const [row] = await db
    .insert(organizations)
    .values({
      name: "Acme",
      ownerId,
      visibilityLevel: "all",
      ...overrides,
    })
    .returning();
  if (row === undefined) throw new Error("org seed failed");
  return row;
}

describe("findDuplicatePairs", () => {
  it("pairs the same email in a different case", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      await person(db, user.id, { name: "A", primaryEmail: "Jane@Example.com" });
      await person(db, user.id, { name: "B", primaryEmail: "jane@example.com" });

      const result = await findDuplicatePairs(db, actorOf(user), "person", signal);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.reasons).toContain("email");
    });
  });

  it("pairs phones that differ only in formatting", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      await person(db, user.id, {
        name: "A",
        phones: [{ value: "+1 (555) 123-4567", label: "mobile" }],
      });
      await person(db, user.id, {
        name: "B",
        phones: [{ value: "555.123.4567", label: "mobile" }],
      });

      const result = await findDuplicatePairs(db, actorOf(user), "person", signal);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.reasons).toContain("phone");
    });
  });

  it("pairs the same name at the same organization only", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const acme = await org(db, user.id, { name: "Acme" });
      const other = await org(db, user.id, { name: "Other" });
      const a = await person(db, user.id, { name: "Jane Doe", orgId: acme.id });
      const b = await person(db, user.id, { name: "Jane Doe", orgId: acme.id });
      await person(db, user.id, { name: "Jane Doe", orgId: other.id });
      await person(db, user.id, { name: "Jane Roe", orgId: acme.id });

      const result = await findDuplicatePairs(db, actorOf(user), "person", signal);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.a.id).toBe(a.id < b.id ? a.id : b.id);
      expect(result.pairs[0]?.reasons).toContain("name_org");
    });
  });

  it("pairs 'Acme Ltd' with 'ACME Limited'", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      await org(db, user.id, { name: "Acme Ltd" });
      await org(db, user.id, { name: "ACME Limited" });

      const result = await findDuplicatePairs(db, actorOf(user), "organization", signal);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.reasons).toContain("name");
    });
  });

  it("pairs the same website domain", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      await org(db, user.id, { name: "One", domain: "https://www.acme.com" });
      await org(db, user.id, { name: "Two", domain: "acme.com" });

      const result = await findDuplicatePairs(db, actorOf(user), "organization", signal);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]?.reasons).toContain("domain");
    });
  });

  it("hides a dismissed pair", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const a = await person(db, user.id, { name: "A", primaryEmail: "same@example.com" });
      const b = await person(db, user.id, { name: "B", primaryEmail: "same@example.com" });

      expect((await findDuplicatePairs(db, actorOf(user), "person", signal)).pairs).toHaveLength(1);
      const dismissed = await dismissPair(db, actorOf(user), "person", a.id, b.id, signal);
      expect(dismissed.ok).toBe(true);
      expect((await findDuplicatePairs(db, actorOf(user), "person", signal)).pairs).toHaveLength(0);
    });
  });

  it("excludes a soft-deleted record", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      await person(db, user.id, { name: "A", primaryEmail: "same@example.com" });
      await person(db, user.id, {
        name: "B",
        primaryEmail: "same@example.com",
        deletedAt: new Date(),
      });

      expect((await findDuplicatePairs(db, actorOf(user), "person", signal)).pairs).toHaveLength(0);
    });
  });

  it("does not show a regular user a pair they cannot see", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const viewer = await seedUser(db);
      await person(db, owner.id, {
        name: "A",
        primaryEmail: "same@example.com",
        visibilityLevel: "owner",
      });
      await person(db, owner.id, {
        name: "B",
        primaryEmail: "same@example.com",
        visibilityLevel: "owner",
      });

      expect((await findDuplicatePairs(db, actorOf(viewer), "person", signal)).pairs).toHaveLength(
        0,
      );
      expect(
        (await findDuplicatePairs(db, actorOf({ id: owner.id, isAdmin: true }), "person", signal))
          .pairs,
      ).toHaveLength(1);
    });
  });
});
