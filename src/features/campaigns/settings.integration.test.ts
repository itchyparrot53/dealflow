import { describe, expect, it } from "vitest";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { getCampaignSettings, saveCampaignSettings } from "./settings";

const signal = new AbortController().signal;

function actorOf(id: string, type: "admin" | "regular" = "admin"): PermSetUser {
  return { id, type, isActive: true, groupIds: new Set(), flags: new Set() };
}

describe("campaign settings", () => {
  it("saves the address, consent and rate, then reads them back", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const saved = await saveCampaignSettings(
        db,
        actorOf(user.id),
        {
          postalAddress: "1 Market Street, London",
          requireDoubleOptIn: false,
          consentLabel: "Yes, send me news",
          sendRatePerMinute: 30,
        },
        signal,
      );
      expect(saved.ok).toBe(true);
      const view = await getCampaignSettings(db, signal);
      expect(view.postalAddress).toBe("1 Market Street, London");
      expect(view.requireDoubleOptIn).toBe(false);
      expect(view.consentLabel).toBe("Yes, send me news");
      expect(view.sendRatePerMinute).toBe(30);
      expect(view.maxRatePerMinute).toBeGreaterThanOrEqual(30);
    });
  });

  it("refuses a rate above the env ceiling and a caller without marketing.manage", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db);
      const tooHigh = await saveCampaignSettings(
        db,
        actorOf(user.id),
        {
          postalAddress: null,
          requireDoubleOptIn: true,
          consentLabel: null,
          sendRatePerMinute: 100_000,
        },
        signal,
      );
      expect(tooHigh.ok).toBe(false);
      const restricted: PermSetUser = {
        id: user.id,
        type: "regular",
        isActive: true,
        groupIds: new Set(),
        flags: new Set(),
      };
      const denied = await saveCampaignSettings(
        db,
        restricted,
        {
          postalAddress: null,
          requireDoubleOptIn: true,
          consentLabel: null,
          sendRatePerMinute: 10,
        },
        signal,
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.id).toBe("E_PERM_001");
    });
  });
});
