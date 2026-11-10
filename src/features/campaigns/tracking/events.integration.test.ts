import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { campaignLinks, campaigns, changeLogs, notifications } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { applyUnsubscribe } from "@/features/marketing/unsubscribe";
import { recordCampaignClick, recordCampaignOpen } from "./events";
import { eventsFor, seedTrackingCampaign, TRACKING_SIGNAL } from "./testFixtures";

const signal = TRACKING_SIGNAL;

describe("campaign tracking events", () => {
  it("records an open once per hit, distinguishes humans and refreshes totals", async () => {
    await withTestDb(async (db) => {
      const { campaign, recipient } = await seedTrackingCampaign(db);
      const token = recipient.token ?? "";
      const openedAt = new Date(Date.now() + 5_000);
      const agent = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15";

      expect(await recordCampaignOpen(db, token, agent, signal, openedAt)).toBe(true);
      expect(await recordCampaignOpen(db, token, agent, signal, openedAt)).toBe(true);

      const opens = (await eventsFor(db, campaign.id)).filter((event) => event.type === "open");
      expect(opens).toHaveLength(2);
      expect(opens[0]?.userAgentFamily).toBe("apple-mail");

      const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
      const totals = updated?.totals as Record<string, number>;
      expect(totals.opens).toBe(2);
      expect(totals.uniqueOpens).toBe(1);
      expect(totals.uniqueHumanOpens).toBe(1);
      expect(totals.machineOpens).toBe(0);
    });
  });

  it("flags a machine open by proxy user agent and by the one-second rule", async () => {
    await withTestDb(async (db) => {
      const { campaign, recipient } = await seedTrackingCampaign(db);
      const token = recipient.token ?? "";
      const sentAt = recipient.sentAt ?? new Date();

      await recordCampaignOpen(
        db,
        token,
        "Mozilla/5.0 (via ggpht.com GoogleImageProxy)",
        signal,
        new Date(sentAt.getTime() + 10_000),
      );
      await recordCampaignOpen(
        db,
        token,
        "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15",
        signal,
        new Date(sentAt.getTime() + 500),
      );

      const opens = (await eventsFor(db, campaign.id)).filter((event) => event.type === "open");
      expect(opens.map((event) => event.userAgentFamily)).toEqual(["proxy", "proxy"]);

      const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
      const totals = updated?.totals as Record<string, number>;
      expect(totals.machineOpens).toBe(2);
      expect(totals.uniqueHumanOpens).toBe(0);
    });
  });

  it("records a click, the timeline wording and an alert to the person's owner", async () => {
    await withTestDb(async (db) => {
      const { campaign, person, recipient, user } = await seedTrackingCampaign(db);

      const target = await recordCampaignClick(
        db,
        recipient.token ?? "",
        0,
        "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
        signal,
      );
      expect(target).toBe("https://example.com/");

      const clicks = (await eventsFor(db, campaign.id)).filter((event) => event.type === "click");
      expect(clicks).toHaveLength(1);
      expect(clicks[0]?.linkIndex).toBe(0);

      const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
      const totals = updated?.totals as Record<string, number>;
      expect(totals.clicks).toBe(1);
      expect(totals.uniqueClicks).toBe(1);

      const timeline = await db
        .select()
        .from(changeLogs)
        .where(and(eq(changeLogs.entityType, "person"), eq(changeLogs.entityId, person.id)));
      expect(
        timeline.some(
          (row) =>
            (row.newValue as { label?: string } | null)?.label === "Clicked example.com in Launch",
        ),
      ).toBe(true);

      const alerts = await db.select().from(notifications).where(eq(notifications.userId, user.id));
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.type).toBe("campaign_click");
      expect(alerts[0]?.entityType).toBe("person");
      expect(alerts[0]?.entityId).toBe(person.id);
      expect(alerts[0]?.payload).toMatchObject({
        personName: "Ada Person",
        campaignName: "Launch",
        linkHost: "example.com",
      });
    });
  });

  it("resolves a merge-token link template with the clicking recipient's values", async () => {
    await withTestDb(async (db) => {
      const { campaign, recipient } = await seedTrackingCampaign(db, {
        href: "https://example.com/?ref={{person.email}}",
      });
      const [link] = await db
        .select()
        .from(campaignLinks)
        .where(eq(campaignLinks.campaignId, campaign.id));
      expect(link?.urlTemplate).toBe("https://example.com/?ref={{person.email}}");

      const target = await recordCampaignClick(
        db,
        recipient.token ?? "",
        0,
        "Mozilla/5.0 Chrome/120.0",
        signal,
      );
      expect(target).not.toBeNull();
      expect(new URL(target ?? "").searchParams.get("ref")).toBe("ada@example.com");
    });
  });

  it("returns null for an unknown token, an unknown index or an unsafe scheme", async () => {
    await withTestDb(async (db) => {
      const { campaign, recipient } = await seedTrackingCampaign(db);
      expect(await recordCampaignOpen(db, "not-a-real-token-value-12345", "agent", signal)).toBe(
        false,
      );
      expect(await recordCampaignClick(db, recipient.token ?? "", 99, "agent", signal)).toBeNull();

      const before = await eventsFor(db, campaign.id);
      expect(before.filter((event) => event.type === "click")).toHaveLength(0);

      await db.insert(campaignLinks).values({
        campaignId: campaign.id,
        linkIndex: 1,
        urlTemplate: "javascript:alert(1)",
      });
      expect(await recordCampaignClick(db, recipient.token ?? "", 1, "agent", signal)).toBeNull();
    });
  });

  it("records the unsubscribe campaign event once, in the consent transaction", async () => {
    await withTestDb(async (db) => {
      const { campaign, person, recipient } = await seedTrackingCampaign(db);
      const result = await applyUnsubscribe(
        db,
        recipient.token ?? "",
        { source: "one_click", ip: null, userAgent: null },
        signal,
      );
      expect(result.ok).toBe(true);
      // A second click on the old footer link is a consent no-op and adds no engagement event.
      await applyUnsubscribe(
        db,
        recipient.token ?? "",
        { source: "one_click", ip: null, userAgent: null },
        signal,
      );

      const unsubscribes = (await eventsFor(db, campaign.id)).filter(
        (event) => event.type === "unsubscribe",
      );
      expect(unsubscribes).toHaveLength(1);

      const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
      expect((updated?.totals as Record<string, number>).unsubscribes).toBe(1);

      const timeline = await db
        .select()
        .from(changeLogs)
        .where(and(eq(changeLogs.entityType, "person"), eq(changeLogs.entityId, person.id)));
      expect(
        timeline.some(
          (row) => (row.newValue as { label?: string } | null)?.label === "Unsubscribed via Launch",
        ),
      ).toBe(true);
    });
  });

  it("records the send on the person timeline", async () => {
    await withTestDb(async (db) => {
      const { person } = await seedTrackingCampaign(db);
      const timeline = await db
        .select()
        .from(changeLogs)
        .where(and(eq(changeLogs.entityType, "person"), eq(changeLogs.entityId, person.id)));
      expect(
        timeline.some(
          (row) => (row.newValue as { label?: string } | null)?.label === "Campaign sent: Launch",
        ),
      ).toBe(true);
    });
  });
});
