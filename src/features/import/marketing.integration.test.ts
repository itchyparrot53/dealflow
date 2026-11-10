import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { importBatches, importRows, personMarketing, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { commitRow, type ImportActor } from "./commit";
import { validateMappedRow } from "./mapRow";
import { undoBatch } from "./undoJob";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;

function adminActor(id: string): ImportActor {
  return {
    id,
    type: "admin",
    isActive: true,
    groupIds: new Set<string>(),
    primaryVisibilityGroupId: null,
    flags: new Set(),
  };
}

async function seedRow(
  db: Db,
  userId: string,
  marketingStatus: string,
  consent: boolean,
): Promise<{ batchId: string; rowId: string }> {
  const [batch] = await db
    .insert(importBatches)
    .values({
      targetEntity: "person",
      filename: "people.csv",
      createdBy: userId,
      status: "completed",
      marketingConsent: consent,
    })
    .returning();
  if (batch === undefined) throw new Error("batch seed failed");
  const [row] = await db
    .insert(importRows)
    .values({
      batchId: batch.id,
      rowNumber: 1,
      raw: {},
      mapped: {
        primary: {
          name: "Grace Hopper",
          emails: [{ label: "work", value: "grace@example.com", primary: true }],
          phones: [],
          orgId: null,
          customFields: {},
        },
        marketingStatus,
      },
      status: "valid",
    })
    .returning();
  if (row === undefined) throw new Error("row seed failed");
  const [person] = await db
    .insert(persons)
    .values({
      name: "Grace Hopper",
      primaryEmail: "grace@example.com",
      ownerId: userId,
      visibilityLevel: "all",
    })
    .returning();
  if (person === undefined) throw new Error("person seed failed");
  return { batchId: batch.id, rowId: row.id };
}

async function statusOf(db: Db, personId: string) {
  const [row] = await db
    .select()
    .from(personMarketing)
    .where(eq(personMarketing.personId, personId));
  return row ?? null;
}

describe("import marketing status", () => {
  it("refuses to subscribe a row without the import-wide confirmation", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const { rowId } = await seedRow(db, user.id, "subscribed", false);

      const result = await commitRow(db, adminActor(user.id), rowId, "person", "update", signal);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("invalid");

      const [row] = await db.select().from(persons);
      expect(row).toBeDefined();
      expect(await statusOf(db, row!.id)).toBeNull();
    });
  });

  it("subscribes with consent and undo restores the previous status", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const { batchId, rowId } = await seedRow(db, user.id, "subscribed", true);

      const committed = await commitRow(db, adminActor(user.id), rowId, "person", "update", signal);
      expect(committed.ok).toBe(true);
      if (committed.ok) expect(committed.value.status).toBe("imported");

      const [person] = await db.select().from(persons);
      const marketing = await statusOf(db, person!.id);
      expect(marketing?.status).toBe("subscribed");
      expect(marketing?.consentBasis).toBe("imported");

      const [row] = await db.select().from(importRows).where(eq(importRows.id, rowId));
      expect(row?.marketingStatusBefore).toBe("not_subscribed");
      expect(row?.marketingPersonId).toBe(person!.id);

      const undone = await undoBatch(db, adminActor(user.id), batchId, signal);
      expect(undone.ok).toBe(true);
      expect((await statusOf(db, person!.id))?.status).toBe("not_subscribed");
    });
  });

  it("imports unsubscribed and undo puts the subscription back", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const { batchId, rowId } = await seedRow(db, user.id, "unsubscribed", false);
      const [person] = await db.select().from(persons);
      // Start subscribed so the import overwrites something undo can restore.
      await db.insert(personMarketing).values({
        personId: person!.id,
        status: "subscribed",
        consentBasis: "explicit",
      });

      const committed = await commitRow(db, adminActor(user.id), rowId, "person", "update", signal);
      expect(committed.ok).toBe(true);
      expect((await statusOf(db, person!.id))?.status).toBe("unsubscribed");

      const undone = await undoBatch(db, adminActor(user.id), batchId, signal);
      expect(undone.ok).toBe(true);
      expect((await statusOf(db, person!.id))?.status).toBe("subscribed");
    });
  });

  it("rejects an unrecognised marketing status cell in validation", () => {
    const result = validateMappedRow(
      "person",
      {
        primary: {
          name: "Ada",
          emails: [{ label: "work", value: "ada@example.com", primary: true }],
          phones: [],
          orgId: null,
          customFields: {},
        },
        marketingStatus: "maybe",
      },
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.field === "marketingStatus")).toBe(true);
    }
  });
});
