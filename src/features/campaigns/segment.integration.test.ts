import { describe, expect, it } from "vitest";
import type { MarketingStatus } from "@/constants/marketing";
import { personMarketing, persons, savedFilters } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { addSuppression, hashEmail } from "@/features/marketing/suppression";
import type { PermSetUser } from "@/features/permissions/effective";
import { previewSegment } from "./segment";

const signal = new AbortController().signal;

function admin(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

const FILTER = {
  combinator: "and" as const,
  conditions: [{ field: "name", op: "contains" as const, value: "Person" }],
};

async function person(
  db: Parameters<Parameters<typeof withTestDb>[0]>[0],
  ownerId: string,
  name: string,
  email: string | null,
  visibility: "all" | "owner" = "all",
) {
  const [row] = await db
    .insert(persons)
    .values({ name, primaryEmail: email, ownerId, visibilityLevel: visibility })
    .returning();
  if (row === undefined) throw new Error("person seed failed");
  return row;
}

async function status(
  db: Parameters<Parameters<typeof withTestDb>[0]>[0],
  personId: string,
  value: MarketingStatus,
) {
  await db.insert(personMarketing).values({ personId, status: value });
}

describe("campaign segment", () => {
  it("counts every exclusion and keeps the deliverable people", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const sendable = await person(db, owner.id, "Person sendable", "send@example.com");
      await status(db, sendable.id, "subscribed");
      const pending = await person(db, owner.id, "Person pending", "pending@example.com");
      await status(db, pending.id, "pending");
      const unsub = await person(db, owner.id, "Person unsub", "unsub@example.com");
      await status(db, unsub.id, "unsubscribed");
      const bounced = await person(db, owner.id, "Person bounce", "bounce@example.com");
      await status(db, bounced.id, "bounced");
      await person(db, owner.id, "Person quiet", "quiet@example.com");
      const noEmail = await person(db, owner.id, "Person noemail", null);
      await status(db, noEmail.id, "subscribed");
      const suppressed = await person(db, owner.id, "Person suppressed", "blocked@example.com");
      await status(db, suppressed.id, "subscribed");
      await addSuppression(db, hashEmail("blocked@example.com"), "unsubscribed", signal);
      const dupOne = await person(db, owner.id, "Person dup one", "dup@example.com");
      await status(db, dupOne.id, "subscribed");
      const dupTwo = await person(db, owner.id, "Person dup two", "dup@example.com");
      await status(db, dupTwo.id, "subscribed");

      const result = await previewSegment(
        db,
        admin(owner.id),
        { kind: "definition", definition: FILTER },
        signal,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.eligible).toHaveLength(2);
      expect(result.value.eligible.map((row) => row.email).sort()).toEqual([
        "dup@example.com",
        "send@example.com",
      ]);
      expect(result.value.exclusions).toEqual({
        notSubscribed: 1,
        pending: 1,
        unsubscribed: 1,
        bounced: 1,
        suppressed: 1,
        noEmail: 1,
        duplicateEmail: 1,
      });
    });
  });

  it("applies the actor's visibility before consent", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const other = await seedUser(db);
      const hidden = await person(db, other.id, "Person hidden", "hidden@example.com", "owner");
      await status(db, hidden.id, "subscribed");
      const visible = await person(db, owner.id, "Person visible", "visible@example.com");
      await status(db, visible.id, "subscribed");

      const regular: PermSetUser = {
        id: owner.id,
        type: "regular",
        isActive: true,
        groupIds: new Set(),
        flags: new Set(["campaigns.view"]),
      };
      const result = await previewSegment(
        db,
        regular,
        { kind: "definition", definition: FILTER },
        signal,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.eligible.map((row) => row.email)).toEqual(["visible@example.com"]);
      expect(result.value.matched).toBe(1);
    });
  });

  it("resolves a saved person filter and refuses one the actor cannot see", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const stranger = await seedUser(db);
      const candidate = await person(db, owner.id, "Person saved", "saved@example.com");
      await status(db, candidate.id, "subscribed");
      const [shared] = await db
        .insert(savedFilters)
        .values({
          name: "People",
          targetEntity: "person",
          definition: FILTER,
          ownerId: owner.id,
          isShared: true,
        })
        .returning();
      const [privateRow] = await db
        .insert(savedFilters)
        .values({
          name: "Private",
          targetEntity: "person",
          definition: FILTER,
          ownerId: stranger.id,
          isShared: false,
        })
        .returning();

      const byShared = await previewSegment(
        db,
        admin(owner.id),
        { kind: "saved_filter", savedFilterId: shared!.id },
        signal,
      );
      expect(byShared.ok).toBe(true);
      if (byShared.ok) expect(byShared.value.eligible).toHaveLength(1);

      const regular: PermSetUser = {
        id: owner.id,
        type: "regular",
        isActive: true,
        groupIds: new Set(),
        flags: new Set(["campaigns.view"]),
      };
      const byPrivate = await previewSegment(
        db,
        regular,
        { kind: "saved_filter", savedFilterId: privateRow!.id },
        signal,
      );
      expect(byPrivate.ok).toBe(false);
      if (!byPrivate.ok) expect(byPrivate.error.id).toBe("E_CAMPAIGN_008");
    });
  });
});
