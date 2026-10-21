import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { BULK_MAX } from "@/constants/productivity";
import { organizations, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { restoreItem } from "@/features/recycle/restore";
import { bulkChangeContactOwner, bulkDeleteContacts } from "./bulk";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function actorOf(user: { id: string }, flags: string[] = [], admin = false): PermSetUser {
  return {
    id: user.id,
    type: admin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(flags) as PermSetUser["flags"],
  };
}

async function person(db: Db, ownerId: string, name: string) {
  const [row] = await db
    .insert(persons)
    .values({ name, ownerId, visibilityLevel: "all" })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

describe("contact bulk actions", () => {
  it("applies the owner change to the editable rows and reports E_BULK_002", async () => {
    await withTestDb(async (db) => {
      const viewer = await seedUser(db);
      const other = await seedUser(db);
      const first = await person(db, viewer.id, "Owned one");
      const second = await person(db, viewer.id, "Owned two");
      const third = await person(db, other.id, "Someone else's");

      const result = await bulkChangeContactOwner(
        db,
        actorOf(viewer, ["contact.edit_own", "deal.changeOwner_own"]),
        "person",
        [first.id, second.id, third.id],
        other.id,
        signal,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.id).toBe("E_BULK_002");
      expect(result.error.context?.applied).toBe(2);
      expect(result.error.context?.failed).toEqual([{ id: third.id, errorId: expect.any(String) }]);

      const reloaded = await db.select().from(persons).where(eq(persons.id, first.id));
      expect(reloaded[0]?.ownerId).toBe(other.id);
    });
  });

  it("deletes the selected people and restores them through the undo helper", async () => {
    await withTestDb(async (db) => {
      const admin = await seedUser(db, { isAdmin: true });
      const first = await person(db, admin.id, "Delete me");
      const second = await person(db, admin.id, "Me too");

      const deleted = await bulkDeleteContacts(
        db,
        actorOf(admin, [], true),
        "person",
        [first.id, second.id],
        signal,
      );
      expect(deleted.ok).toBe(true);
      const deletedRows = await db.select().from(persons).where(eq(persons.id, first.id));
      expect(deletedRows[0]?.deletedAt).not.toBeNull();

      for (const id of [first.id, second.id]) {
        const restored = await restoreItem(
          db,
          actorOf(admin, [], true),
          { entity: "person", id },
          signal,
        );
        expect(restored.ok).toBe(true);
      }
      const restoredRows = await db.select().from(persons).where(eq(persons.id, first.id));
      expect(restoredRows[0]?.deletedAt).toBeNull();
    });
  });

  it("refuses more than BULK_MAX ids before writing anything", async () => {
    await withTestDb(async (db) => {
      const admin = await seedUser(db, { isAdmin: true });
      const ids = Array.from({ length: BULK_MAX + 1 }, () => crypto.randomUUID());

      const result = await bulkChangeContactOwner(
        db,
        actorOf(admin, [], true),
        "organization",
        ids,
        admin.id,
        signal,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.id).toBe("E_BULK_001");
      expect(await db.select().from(organizations)).toHaveLength(0);
    });
  });
});
