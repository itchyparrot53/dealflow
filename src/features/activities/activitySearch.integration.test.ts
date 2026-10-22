import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { activities, activityTypes } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { listActivityRows } from "./activityRows";
import { noFilter } from "./activityRowsTestHelpers";

function actor(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

async function callType(db: Parameters<Parameters<typeof withTestDb>[0]>[0]) {
  const [type] = await db.select().from(activityTypes).where(eq(activityTypes.key, "call"));
  if (type === undefined) throw new Error("activity type 'call' not found");
  return type;
}

describe("activities list search", () => {
  it("matches the subject and the note, case-insensitively", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const type = await callType(db);
      const base = {
        typeId: type.id,
        ownerId: user.id,
        assigneeId: user.id,
        dueAt: new Date("2026-07-10T09:00:00.000Z"),
        done: false,
      };
      await db.insert(activities).values([
        { ...base, subject: "Renewal call", note: "<p>pricing questions</p>" },
        { ...base, subject: "Kickoff", note: "<p>Discuss RENEWAL terms</p>" },
        { ...base, subject: "Unrelated", note: null },
      ]);

      const bySubject = await listActivityRows(
        db,
        actor(user.id),
        { ...noFilter, search: "renewal" },
        signal(),
      );
      expect(bySubject.map((row) => row.subject).sort()).toEqual(["Kickoff", "Renewal call"]);

      const byNote = await listActivityRows(
        db,
        actor(user.id),
        { ...noFilter, search: "PRICING" },
        signal(),
      );
      expect(byNote.map((row) => row.subject)).toEqual(["Renewal call"]);
    });
  });

  it("treats a cleared search as no filter", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const type = await callType(db);
      await db.insert(activities).values({
        typeId: type.id,
        subject: "Only activity",
        ownerId: user.id,
        assigneeId: user.id,
        dueAt: new Date("2026-07-10T09:00:00.000Z"),
      });
      const rows = await listActivityRows(
        db,
        actor(user.id),
        { ...noFilter, search: "" },
        signal(),
      );
      expect(rows).toHaveLength(1);
    });
  });
});
