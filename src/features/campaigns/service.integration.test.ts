import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { campaigns } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { createCampaign, deleteCampaign, updateCampaign } from "./service";

const signal = new AbortController().signal;

function actorOf(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

describe("campaign service", () => {
  it("creates a draft, updates it and refuses to edit a sent campaign", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const created = await createCampaign(
        db,
        actorOf(user.id),
        {
          name: "Launch",
          type: "announcement",
          subject: "",
          preheader: null,
          templateId: null,
          content: null,
        },
        signal,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const updated = await updateCampaign(
        db,
        actorOf(user.id),
        { id: created.value.id, subject: "Hello" },
        signal,
      );
      expect(updated.ok).toBe(true);
      const [row] = await db.select().from(campaigns).where(eq(campaigns.id, created.value.id));
      expect(row?.subject).toBe("Hello");
      expect(row?.status).toBe("draft");

      await db.update(campaigns).set({ status: "sent" }).where(eq(campaigns.id, created.value.id));
      const refused = await updateCampaign(
        db,
        actorOf(user.id),
        { id: created.value.id, subject: "Changed" },
        signal,
      );
      expect(refused.ok).toBe(false);
      const deleted = await deleteCampaign(db, actorOf(user.id), created.value.id, signal);
      expect(deleted.ok).toBe(false);
    });
  });

  it("deletes a draft", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const created = await createCampaign(
        db,
        actorOf(user.id),
        {
          name: "Gone",
          type: "other",
          subject: "",
          preheader: null,
          templateId: null,
          content: null,
        },
        signal,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const deleted = await deleteCampaign(db, actorOf(user.id), created.value.id, signal);
      expect(deleted.ok).toBe(true);
      expect(await db.select().from(campaigns)).toHaveLength(0);
    });
  });
});
