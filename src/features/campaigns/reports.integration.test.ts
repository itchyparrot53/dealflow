import { describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { campaignEvents, campaignLinks, campaignRecipients, campaigns, persons } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { hashEmail } from "@/features/marketing/suppression";
import { hashMarketingToken } from "@/features/marketing/tokens";
import type { PermSetUser } from "@/features/permissions/effective";
import { campaignRates, campaignRecipientsCsv, getCampaignReport } from "./reports";

const SIGNAL = new AbortController().signal;

function actor(id: string, flags: PermissionFlagKey[] = []): PermSetUser {
  return {
    id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(flags),
  };
}

async function setupCampaign(db: Parameters<Parameters<typeof withTestDb>[0]>[0]) {
  const owner = await seedUser(db, { isAdmin: false, name: "Owner" });
  const other = await seedUser(db, { isAdmin: false, name: "Other" });
  const admin = await seedUser(db, { isAdmin: true, name: "Admin" });
  const [c1, c2, c3, c4] = await db
    .insert(persons)
    .values([
      {
        name: "Ada One",
        primaryEmail: "ada@example.com",
        ownerId: owner.id,
        visibilityLevel: "all",
      },
      {
        name: "Bea Two",
        primaryEmail: "bea@example.com",
        ownerId: other.id,
        visibilityLevel: "owner",
      },
      {
        name: "Cal Three",
        primaryEmail: "cal@example.com",
        ownerId: owner.id,
        visibilityLevel: "all",
      },
      {
        name: "Dee Four",
        primaryEmail: "dee@example.com",
        ownerId: owner.id,
        visibilityLevel: "all",
      },
    ])
    .returning();
  if (c1 === undefined || c2 === undefined || c3 === undefined || c4 === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "person insert failed");
  }
  const [campaign] = await db
    .insert(campaigns)
    .values({
      name: "Report campaign",
      type: "newsletter",
      status: "sent",
      subject: "Hello",
      createdBy: owner.id,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      finishedAt: new Date(),
    })
    .returning();
  if (campaign === undefined)
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "campaign insert failed");

  const recipients = [
    { personId: c1.id, email: "ada@example.com", status: "sent" },
    { personId: c2.id, email: "bea@example.com", status: "sent" },
    { personId: c3.id, email: "cal@example.com", status: "skipped_status" },
    { personId: c4.id, email: "dee@example.com", status: "bounced_hard" },
  ];
  const recipientRows = await db
    .insert(campaignRecipients)
    .values(
      recipients.map((recipient) => ({
        campaignId: campaign.id,
        personId: recipient.personId,
        email: recipient.email,
        emailHash: hashEmail(recipient.email),
        status: recipient.status,
        token: "token",
        tokenHash: hashMarketingToken(`token-${recipient.email}`),
        sentAt: new Date(),
      })),
    )
    .returning({ id: campaignRecipients.id, personId: campaignRecipients.personId });
  const [r1, r2, , r4] = recipientRows;
  if (r1 === undefined || r2 === undefined || r4 === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "recipient insert failed");
  }
  await db.insert(campaignLinks).values({
    campaignId: campaign.id,
    linkIndex: 0,
    urlTemplate: "https://example.com/offer",
  });
  await db.insert(campaignEvents).values([
    { campaignId: campaign.id, recipientId: r1.id, personId: c1.id, type: "delivered" },
    { campaignId: campaign.id, recipientId: r2.id, personId: c2.id, type: "delivered" },
    { campaignId: campaign.id, recipientId: r4.id, personId: c4.id, type: "delivered" },
    {
      campaignId: campaign.id,
      recipientId: r1.id,
      personId: c1.id,
      type: "open",
      userAgentFamily: "chrome",
    },
    {
      campaignId: campaign.id,
      recipientId: r2.id,
      personId: c2.id,
      type: "open",
      userAgentFamily: "proxy",
    },
    {
      campaignId: campaign.id,
      recipientId: r1.id,
      personId: c1.id,
      type: "click",
      linkIndex: 0,
      userAgentFamily: "chrome",
    },
    { campaignId: campaign.id, recipientId: r1.id, personId: c1.id, type: "unsubscribe" },
    { campaignId: campaign.id, recipientId: r4.id, personId: c4.id, type: "bounce_hard" },
  ]);
  return { owner, other, admin, campaign, c1, c2 };
}

describe("campaign report", () => {
  it("aggregates recipients, events, links and per-recipient statuses", async () => {
    await withTestDb(async (db) => {
      const { admin, campaign } = await setupCampaign(db);
      const report = await getCampaignReport(
        db,
        {
          id: admin.id,
          type: "admin",
          isActive: true,
          groupIds: new Set(),
          flags: new Set(),
        },
        campaign.id,
        SIGNAL,
      );
      expect(report).not.toBeNull();
      if (report === null) return;

      expect(report.summary).toMatchObject({
        recipients: 4,
        sent: 3,
        delivered: 2,
        uniqueOpens: 1,
        uniqueOpensAll: 2,
        machineOpens: 1,
        clicks: 1,
        uniqueClicks: 1,
        unsubscribes: 1,
        bouncesHard: 1,
        bouncesSoft: 0,
        complaints: 0,
      });
      expect(report.links).toEqual([
        { index: 0, url: "https://example.com/offer", uniqueClicks: 1, clicks: 1 },
      ]);
      expect(report.seriesKind).toBe("hour");
      expect(report.series).toHaveLength(48);
      expect(report.series.reduce((sum, point) => sum + point.opens, 0)).toBe(2);
      expect(report.series.reduce((sum, point) => sum + point.clicks, 0)).toBe(1);

      const statuses = new Map(report.recipients.map((row) => [row.email, row.status]));
      expect(statuses.get("ada@example.com")).toBe("unsubscribed");
      expect(statuses.get("bea@example.com")).toBe("opened");
      expect(statuses.get("cal@example.com")).toBe("skipped");
      expect(statuses.get("dee@example.com")).toBe("bounced_hard");
      expect(
        report.recipients.find((row) => row.email === "ada@example.com")?.lastActivity,
      ).not.toBeNull();
    });
  });

  it("applies people visibility to the recipient table and the CSV, not to the totals", async () => {
    await withTestDb(async (db) => {
      const { owner, campaign } = await setupCampaign(db);
      const viewer = actor(owner.id, ["campaigns.view", "data.export"]);
      const report = await getCampaignReport(db, viewer, campaign.id, SIGNAL);
      expect(report).not.toBeNull();
      if (report === null) return;

      expect(report.recipients.map((row) => row.email)).not.toContain("bea@example.com");
      expect(report.recipientTotal).toBe(3);
      // The totals still count the click and the machine open from the hidden person.
      expect(report.summary.uniqueClicks).toBe(1);
      expect(report.summary.machineOpens).toBe(1);

      const csv = campaignRecipientsCsv(report.recipients);
      expect(csv.split("\r\n")[0]).toBe("Person,Email,Status,Last activity");
      expect(csv).toContain("ada@example.com");
      expect(csv).not.toContain("bea@example.com");
    });
  });

  it("renders divide-by-zero rates as null and hides drafts", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const [campaign] = await db
        .insert(campaigns)
        .values({
          name: "Empty",
          type: "newsletter",
          status: "sent",
          subject: "Nothing",
          createdBy: user.id,
          startedAt: new Date(),
        })
        .returning();
      if (campaign === undefined)
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "campaign insert failed");
      const report = await getCampaignReport(
        db,
        { id: user.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() },
        campaign.id,
        SIGNAL,
      );
      expect(report).not.toBeNull();
      if (report === null) return;
      const rates = campaignRates(report.summary, false);
      expect(rates.openRate).toBeNull();
      expect(rates.clickRate).toBeNull();
      expect(rates.ctor).toBeNull();

      const [draft] = await db
        .insert(campaigns)
        .values({
          name: "Draft",
          type: "newsletter",
          status: "draft",
          subject: "Soon",
          createdBy: user.id,
        })
        .returning();
      if (draft === undefined)
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "draft insert failed");
      expect(
        await getCampaignReport(
          db,
          { id: user.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() },
          draft.id,
          SIGNAL,
        ),
      ).toBeNull();
    });
  });

  it("refuses a viewer without campaigns.view", async () => {
    await withTestDb(async (db) => {
      const { owner, campaign } = await setupCampaign(db);
      expect(await getCampaignReport(db, actor(owner.id), campaign.id, SIGNAL)).toBeNull();
    });
  });
});
