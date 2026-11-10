import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  campaignEvents,
  campaignRecipients,
  campaignSenders,
  campaignSettings,
  campaigns,
  changeLogs,
  marketingSuppressions,
  personMarketing,
  persons,
} from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import { createFakeTransportFactory } from "@/features/mail/transport/fake";
import { fakeAppend, fakeList } from "@/features/mail/transport/fakeStore";
import { hashEmail } from "@/features/marketing/suppression";
import { hashMarketingToken } from "@/features/marketing/tokens";
import { bounceMailboxConfigured } from "./config";
import { runBounceMailbox } from "./mailbox";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const RECIPIENT_ID = "22222222-2222-4222-8222-222222222222";
const BOUNCE_ADDRESS = "bounce@example.com";
const BOUNCE_PASSWORD = "bounce-pass-123";
const SIGNAL = new AbortController().signal;

function fixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
}

interface Fixture {
  personId: string;
}

async function seedReportCampaign(
  db: Parameters<Parameters<typeof withTestDb>[0]>[0],
): Promise<Fixture> {
  const user = await seedUser(db, { isAdmin: true });
  const [person] = await db
    .insert(persons)
    .values({
      name: "Ada Person",
      firstName: "Ada",
      primaryEmail: "ada@example.com",
      ownerId: user.id,
      visibilityLevel: "all",
    })
    .returning();
  if (person === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "person insert failed");
  }
  await db.insert(personMarketing).values({ personId: person.id, status: "subscribed" });
  const [sender] = await db
    .insert(campaignSenders)
    .values({
      fromName: "Northwind News",
      fromEmail: `news-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      verifiedAt: new Date(),
    })
    .returning();
  if (sender === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "sender insert failed");
  }
  await db.insert(campaigns).values({
    id: CAMPAIGN_ID,
    name: "Launch",
    type: "announcement",
    status: "sent",
    subject: "Something new",
    senderId: sender.id,
    createdBy: user.id,
    content: {
      version: 1,
      settings: {
        backgroundColor: "#F4F4F2",
        contentWidth: 600,
        fontFamily: "system",
        linkColor: "#2D8548",
      },
      blocks: [],
    },
    segment: { kind: "definition", definition: { combinator: "and", conditions: [] } },
  });
  await db.insert(campaignRecipients).values({
    id: RECIPIENT_ID,
    campaignId: CAMPAIGN_ID,
    personId: person.id,
    email: "ada@example.com",
    emailHash: hashEmail("ada@example.com"),
    status: "sent",
    token: "recipient-token",
    tokenHash: hashMarketingToken("recipient-token"),
    sentAt: new Date("2026-11-10T09:59:00.000Z"),
  });
  return { personId: person.id };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dealflow-bounce-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function credentials() {
  return {
    host: "imap.example.com",
    port: 993,
    secure: true,
    username: BOUNCE_ADDRESS,
    password: BOUNCE_PASSWORD,
  };
}

function deliver(name: string): void {
  fakeAppend(dir, BOUNCE_ADDRESS, "INBOX", fixture(name));
}

async function run(db: Parameters<Parameters<typeof withTestDb>[0]>[0]) {
  return runBounceMailbox(db, SIGNAL, {
    credentials: credentials(),
    factory: createFakeTransportFactory(dir),
  });
}

describe("campaign bounce mailbox", () => {
  it("is disabled when the four env values are unset", async () => {
    expect(bounceMailboxConfigured()).toBe(false);
    await withTestDb(async (db) => {
      const summary = await runBounceMailbox(db, SIGNAL, { credentials: null });
      expect(summary).toEqual({ ok: true, value: { configured: false, processed: 0, ignored: 0 } });
    });
  });

  it("applies a hard bounce, moves the report to Processed and updates the run state", async () => {
    await withTestDb(async (db) => {
      const { personId } = await seedReportCampaign(db);
      deliver("gmail-hard.eml");

      const result = await run(db);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.processed).toBe(1);

      const [recipient] = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.id, RECIPIENT_ID));
      expect(recipient?.status).toBe("bounced_hard");

      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, personId));
      expect(marketing?.status).toBe("bounced");

      const events = await db
        .select()
        .from(campaignEvents)
        .where(eq(campaignEvents.campaignId, CAMPAIGN_ID));
      expect(events.filter((event) => event.type === "bounce_hard")).toHaveLength(1);

      const suppression = await db
        .select()
        .from(marketingSuppressions)
        .where(eq(marketingSuppressions.emailHash, hashEmail("ada@example.com")));
      expect(suppression[0]?.reason).toBe("hard_bounce");

      const timeline = await db.select().from(changeLogs).where(eq(changeLogs.entityId, personId));
      expect(
        timeline.some(
          (row) => (row.newValue as { label?: string } | null)?.label === "Bounced (hard)",
        ),
      ).toBe(true);

      expect(fakeList(dir, BOUNCE_ADDRESS, "INBOX")).toHaveLength(0);
      expect(fakeList(dir, BOUNCE_ADDRESS, "Processed")).toHaveLength(1);

      const [settings] = await db.select().from(campaignSettings).where(eq(campaignSettings.id, 1));
      expect(settings?.bounceLastRunAt).not.toBeNull();
      expect(settings?.bounceLastProcessed).toBe(1);

      // A second run finds nothing and does not duplicate the event.
      const second = await run(db);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.value.processed).toBe(0);
      const after = await db
        .select()
        .from(campaignEvents)
        .where(eq(campaignEvents.campaignId, CAMPAIGN_ID));
      expect(after.filter((event) => event.type === "bounce_hard")).toHaveLength(1);
    });
  });

  it("records a soft bounce and keeps the person subscribed", async () => {
    await withTestDb(async (db) => {
      const { personId } = await seedReportCampaign(db);
      deliver("postfix-soft.eml");

      const result = await run(db);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.processed).toBe(1);

      const [recipient] = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.id, RECIPIENT_ID));
      expect(recipient?.status).toBe("failed_soft");
      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, personId));
      expect(marketing?.status).toBe("subscribed");
      expect(marketing?.softBounceCount).toBe(1);
      const events = await db
        .select()
        .from(campaignEvents)
        .where(eq(campaignEvents.campaignId, CAMPAIGN_ID));
      expect(events.filter((event) => event.type === "bounce_soft")).toHaveLength(1);
    });
  });

  it("treats an ARF report as a complaint and unsubscribes the person", async () => {
    await withTestDb(async (db) => {
      const { personId } = await seedReportCampaign(db);
      deliver("arf-complaint.eml");

      const result = await run(db);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.processed).toBe(1);

      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, personId));
      expect(marketing?.status).toBe("unsubscribed");
      const suppression = await db
        .select()
        .from(marketingSuppressions)
        .where(eq(marketingSuppressions.emailHash, hashEmail("ada@example.com")));
      expect(suppression[0]?.reason).toBe("complaint");

      const events = await db
        .select()
        .from(campaignEvents)
        .where(eq(campaignEvents.campaignId, CAMPAIGN_ID));
      expect(events.filter((event) => event.type === "complaint")).toHaveLength(1);

      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, CAMPAIGN_ID));
      expect((campaign?.totals as Record<string, number>).complaints).toBe(1);
    });
  });

  it("ignores a message that is not a report", async () => {
    await withTestDb(async (db) => {
      await seedReportCampaign(db);
      fakeAppend(
        dir,
        BOUNCE_ADDRESS,
        "INBOX",
        Buffer.from(
          [
            "From: someone@example.com",
            "To: bounce@example.com",
            "Subject: Not a report",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "hello",
          ].join("\r\n"),
        ),
      );

      const result = await run(db);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.processed).toBe(0);
      expect(result.value.ignored).toBe(1);
      expect(result.value.configured).toBe(true);
    });
  });
});
