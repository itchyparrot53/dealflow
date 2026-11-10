import { describe, expect, it } from "vitest";
import { withTestDb } from "@/db/testing";
import { eventsFor, seedTrackingCampaign, TRACKING_SIGNAL } from "./testFixtures";
import { loadCampaignWebVersion } from "./webVersion";

const signal = TRACKING_SIGNAL;

describe("campaign web version", () => {
  it("renders the recipient's copy with untracked links and no open event", async () => {
    await withTestDb(async (db) => {
      const { campaign, recipient } = await seedTrackingCampaign(db);
      const before = await eventsFor(db, campaign.id);

      const view = await loadCampaignWebVersion(db, recipient.token ?? "", signal);
      expect(view).not.toBeNull();
      expect(view?.campaignName).toBe("Launch");
      expect(view?.html).toContain("Hi Ada");
      expect(view?.html).toContain("Take a look");
      expect(view?.html).toContain('href="https://example.com"');
      expect(view?.html).not.toContain("/t/c/l/");
      expect(view?.html).not.toContain("/t/c/o/");
      expect(view?.html).toContain("/u/");

      const after = await eventsFor(db, campaign.id);
      expect(after).toHaveLength(before.length);
    });
  });

  it("returns null for an unknown token", async () => {
    await withTestDb(async (db) => {
      expect(await loadCampaignWebVersion(db, "not-a-real-token-value-12345", signal)).toBeNull();
    });
  });
});
