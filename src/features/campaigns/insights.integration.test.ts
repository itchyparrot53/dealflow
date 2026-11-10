import { describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  campaignEvents,
  campaignRecipients,
  campaignSenders,
  campaigns,
  persons,
  sequenceSteps,
  sequences,
} from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { hashEmail } from "@/features/marketing/suppression";
import { hashMarketingToken } from "@/features/marketing/tokens";
import type { PermSetUser } from "@/features/permissions/effective";
import { getCampaignInsights } from "./insights";

const SIGNAL = new AbortController().signal;
const DAY = 24 * 60 * 60 * 1000;

function admin(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

type Db = Parameters<Parameters<typeof withTestDb>[0]>[0];

async function addCampaign(
  db: Db,
  input: {
    name: string;
    type: string;
    senderId: string | null;
    startedAt: Date;
    status?: string;
  },
): Promise<string> {
  const [row] = await db
    .insert(campaigns)
    .values({
      name: input.name,
      type: input.type,
      status: input.status ?? "sent",
      subject: input.name,
      senderId: input.senderId,
      startedAt: input.startedAt,
    })
    .returning({ id: campaigns.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "campaign insert failed");
  return row.id;
}

interface EventSpec {
  type: "delivered" | "open" | "click" | "unsubscribe" | "bounce_hard";
  agent?: string | null;
}

async function addRecipient(
  db: Db,
  campaignId: string,
  personId: string,
  email: string,
  events: EventSpec[],
): Promise<void> {
  const [recipient] = await db
    .insert(campaignRecipients)
    .values({
      campaignId,
      personId,
      email,
      emailHash: hashEmail(email),
      status: "sent",
      token: "token",
      tokenHash: hashMarketingToken(`${campaignId}:${email}`),
      sentAt: new Date(),
    })
    .returning({ id: campaignRecipients.id });
  if (recipient === undefined)
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "recipient insert failed");
  if (events.length === 0) return;
  await db.insert(campaignEvents).values(
    events.map((event) => ({
      campaignId,
      recipientId: recipient.id,
      personId,
      type: event.type,
      linkIndex: event.type === "click" ? 0 : null,
      userAgentFamily: event.agent ?? null,
    })),
  );
}

describe("campaign insights", () => {
  it("compares campaigns in the range, filters by type and sender, and excludes old and hidden campaigns", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const now = new Date();
      const senderA = await db
        .insert(campaignSenders)
        .values({
          fromName: "Sender A",
          fromEmail: `a-${Date.now()}@example.com`,
          verifiedAt: new Date(),
        })
        .returning({ id: campaignSenders.id });
      const senderB = await db
        .insert(campaignSenders)
        .values({
          fromName: "Sender B",
          fromEmail: `b-${Date.now()}@example.com`,
          verifiedAt: new Date(),
        })
        .returning({ id: campaignSenders.id });
      if (senderA[0] === undefined || senderB[0] === undefined) {
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "sender insert failed");
      }
      const people = await db
        .insert(persons)
        .values([
          {
            name: "One",
            primaryEmail: "one@example.com",
            ownerId: user.id,
            visibilityLevel: "all",
          },
          {
            name: "Two",
            primaryEmail: "two@example.com",
            ownerId: user.id,
            visibilityLevel: "all",
          },
          {
            name: "Three",
            primaryEmail: "three@example.com",
            ownerId: user.id,
            visibilityLevel: "all",
          },
          {
            name: "Four",
            primaryEmail: "four@example.com",
            ownerId: user.id,
            visibilityLevel: "all",
          },
        ])
        .returning({ id: persons.id });
      const [p1, p2, p3, p4] = people;
      if (p1 === undefined || p2 === undefined || p3 === undefined || p4 === undefined) {
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "person insert failed");
      }

      const c1 = await addCampaign(db, {
        name: "Newsletter",
        type: "newsletter",
        senderId: senderA[0].id,
        startedAt: new Date(now.getTime() - 2 * DAY),
      });
      await addRecipient(db, c1, p1.id, "one@example.com", [
        { type: "delivered" },
        { type: "open", agent: "chrome" },
        { type: "click", agent: "chrome" },
        { type: "unsubscribe" },
      ]);
      await addRecipient(db, c1, p2.id, "two@example.com", [
        { type: "delivered" },
        { type: "open", agent: "proxy" },
      ]);
      const c2 = await addCampaign(db, {
        name: "Announcement",
        type: "announcement",
        senderId: senderB[0].id,
        startedAt: new Date(now.getTime() - 10 * DAY),
      });
      await addRecipient(db, c2, p3.id, "three@example.com", [
        { type: "delivered" },
        { type: "open", agent: "chrome" },
      ]);
      await addCampaign(db, {
        name: "Old newsletter",
        type: "newsletter",
        senderId: senderA[0].id,
        startedAt: new Date(now.getTime() - 120 * DAY),
      });

      const [sequence] = await db
        .insert(sequences)
        .values({ name: "Nurture", status: "active", createdBy: user.id })
        .returning({ id: sequences.id });
      if (sequence === undefined)
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "sequence insert failed");
      const hidden = await addCampaign(db, {
        name: "Nurture step 1",
        type: "nurture",
        senderId: senderA[0].id,
        startedAt: new Date(now.getTime() - DAY),
        status: "sending",
      });
      await db.insert(sequenceSteps).values({
        sequenceId: sequence.id,
        position: 0,
        kind: "email",
        subject: "Step one",
        campaignId: hidden,
      });
      await addRecipient(db, hidden, p4.id, "four@example.com", [
        { type: "delivered" },
        { type: "open", agent: "chrome" },
        { type: "click", agent: "chrome" },
      ]);

      const result = await getCampaignInsights(
        db,
        admin(user.id),
        { since: new Date(now.getTime() - 90 * DAY) },
        SIGNAL,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.campaigns.map((row) => row.name)).toEqual(["Newsletter", "Announcement"]);
      const first = result.value.campaigns[0];
      expect(first?.recipients).toBe(2);
      expect(first?.delivered).toBe(2);
      expect(first?.uniqueOpens).toBe(1);
      expect(first?.openRate).toBeCloseTo(0.5, 10);
      expect(first?.ctor).toBeCloseTo(1, 10);
      expect(result.value.average.openRate).toBeCloseTo(0.75, 10);
      expect(result.value.average.clickRate).toBeCloseTo(0.25, 10);

      const byType = await getCampaignInsights(
        db,
        admin(user.id),
        { since: new Date(now.getTime() - 90 * DAY), type: "announcement" },
        SIGNAL,
      );
      expect(byType.ok).toBe(true);
      if (!byType.ok) return;
      expect(byType.value.campaigns.map((row) => row.name)).toEqual(["Announcement"]);

      const bySender = await getCampaignInsights(
        db,
        admin(user.id),
        { since: new Date(now.getTime() - 90 * DAY), senderId: senderA[0].id },
        SIGNAL,
      );
      expect(bySender.ok).toBe(true);
      if (!bySender.ok) return;
      expect(bySender.value.campaigns.map((row) => row.name)).toEqual(["Newsletter"]);

      expect(result.value.sequences.map((row) => row.name)).toEqual(["Nurture"]);
      expect(result.value.sequences[0]?.openRate).toBeCloseTo(1, 10);
      expect(result.value.steps).toHaveLength(1);
      expect(result.value.steps[0]?.subject).toBe("Step one");
      expect(result.value.senders.map((row) => row.name).sort()).toEqual(["Sender A", "Sender B"]);
    });
  });

  it("refuses a viewer without campaigns.view", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: false });
      const result = await getCampaignInsights(
        db,
        { id: user.id, type: "regular", isActive: true, groupIds: new Set(), flags: new Set() },
        { since: new Date() },
        SIGNAL,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe("E_PERM_001");
    });
  });
});
