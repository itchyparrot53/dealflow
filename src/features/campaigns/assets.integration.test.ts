import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { campaignAssets } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { FakeStorageClient } from "@/features/files/storageFake";
import type { PermSetUser } from "@/features/permissions/effective";
import { getCampaignAssetBytes, saveCampaignAsset } from "./assets";

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

const signal = new AbortController().signal;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function admin(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

function regular(id: string, flags: string[]): PermSetUser {
  return {
    id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(flags) as PermSetUser["flags"],
  };
}

describe("campaign assets", () => {
  it("stores a PNG and serves its bytes back by id and extension", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const storage = new FakeStorageClient();
      const saved = await saveCampaignAsset(
        db,
        admin(user.id),
        { bytes: PNG },
        signal,
        storage,
      );
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      expect(saved.value.url).toBe(`/email-assets/c/${saved.value.id}.png`);
      expect(saved.value.mime).toBe("image/png");

      const fetched = await getCampaignAssetBytes(db, saved.value.id, "png", signal, storage);
      expect(fetched?.mime).toBe("image/png");
      expect(fetched?.bytes.equals(PNG)).toBe(true);

      const wrongExt = await getCampaignAssetBytes(db, saved.value.id, "gif", signal, storage);
      expect(wrongExt).toBeNull();
      const missing = await getCampaignAssetBytes(
        db,
        "00000000-0000-4000-8000-000000000000",
        "png",
        signal,
        storage,
      );
      expect(missing).toBeNull();
    });
  });

  it("deduplicates by sha256", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const storage = new FakeStorageClient();
      const first = await saveCampaignAsset(db, admin(user.id), { bytes: PNG }, signal, storage);
      const second = await saveCampaignAsset(db, admin(user.id), { bytes: PNG }, signal, storage);
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.value.id).toBe(first.value.id);
      expect(await db.select().from(campaignAssets)).toHaveLength(1);
    });
  });

  it("rejects an empty, oversized or non-image file", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const storage = new FakeStorageClient();
      const empty = await saveCampaignAsset(db, admin(user.id), { bytes: Buffer.alloc(0) }, signal, storage);
      expect(empty.ok).toBe(false);
      const big = await saveCampaignAsset(
        db,
        admin(user.id),
        { bytes: Buffer.alloc(1024 * 1024 + 1) },
        signal,
        storage,
      );
      expect(big.ok).toBe(false);
      const text = await saveCampaignAsset(
        db,
        admin(user.id),
        { bytes: Buffer.from("not an image") },
        signal,
        storage,
      );
      expect(text.ok).toBe(false);
      if (!text.ok) expect(text.error.id).toBe("E_CAMPAIGN_007");
    });
  });

  it("requires campaigns.edit", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const storage = new FakeStorageClient();
      const denied = await saveCampaignAsset(
        db,
        regular(user.id, []),
        { bytes: PNG },
        signal,
        storage,
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.id).toBe("E_PERM_001");
      expect(await db.select().from(campaignAssets).where(eq(campaignAssets.sha256, "x"))).toHaveLength(0);
    });
  });
});
