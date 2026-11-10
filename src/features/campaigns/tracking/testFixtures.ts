import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  campaignEvents,
  campaignRecipients,
  campaignSenders,
  campaigns,
  personMarketing,
  persons,
  type users,
} from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import type { SystemMail } from "@/features/mailer/types";
import type { CampaignDocument } from "../blocks/schema";
import { runCampaignTick, snapshotCampaign } from "../send/batch";

// Shared fixture for the tracking and web-version integration tests: one subscribed person owned
// by an admin, one verified sender, a campaign with a button, and a completed first tick so the
// recipient has a token and a sent_at.

export const TRACKING_SIGNAL = new AbortController().signal;

export function trackingDocument(href: string): CampaignDocument {
  return {
    version: 1,
    settings: {
      backgroundColor: "#F4F4F2",
      contentWidth: 600,
      fontFamily: "system",
      linkColor: "#2D8548",
    },
    blocks: [
      { id: "h", type: "header", logo: "none", align: "left" },
      { id: "t", type: "text", html: "<p>Hi {{person.first_name}}</p>" },
      { id: "b", type: "button", label: "Take a look", href, align: "left" },
    ],
  };
}

function first<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, `${what} insert returned no row`);
  }
  return row;
}

export interface TrackingFixture {
  user: typeof users.$inferSelect;
  person: typeof persons.$inferSelect;
  campaign: typeof campaigns.$inferSelect;
  recipient: typeof campaignRecipients.$inferSelect;
  mails: SystemMail[];
}

export async function seedTrackingCampaign(
  db: Db,
  options: { href?: string; signal?: AbortSignal } = {},
): Promise<TrackingFixture> {
  const signal = options.signal ?? TRACKING_SIGNAL;
  const user = await seedUser(db, { isAdmin: true, name: "Owner User" });
  const person = first(
    await db
      .insert(persons)
      .values({
        name: "Ada Person",
        firstName: "Ada",
        primaryEmail: "ada@example.com",
        ownerId: user.id,
        visibilityLevel: "all",
      })
      .returning(),
    "person",
  );
  await db.insert(personMarketing).values({ personId: person.id, status: "subscribed" });
  const sender = first(
    await db
      .insert(campaignSenders)
      .values({
        fromName: "Northwind News",
        // Unique per fixture: the test suites can seed several campaigns in one database.
        fromEmail: `news-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        verifiedAt: new Date(),
      })
      .returning(),
    "sender",
  );
  const campaign = first(
    await db
      .insert(campaigns)
      .values({
        name: "Launch",
        type: "announcement",
        subject: "Something new",
        preheader: "A preview line",
        senderId: sender.id,
        createdBy: user.id,
        content: trackingDocument(options.href ?? "https://example.com"),
        segment: {
          kind: "definition",
          definition: {
            combinator: "and",
            conditions: [{ field: "name", op: "contains", value: "Person" }],
          },
        },
      })
      .returning(),
    "campaign",
  );

  const snapshot = await snapshotCampaign(db, campaign.id, signal);
  if (!snapshot.ok) {
    throw new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, `snapshot failed: ${snapshot.error.id}`);
  }

  const mails: SystemMail[] = [];
  await runCampaignTick(db, campaign.id, signal, {
    send: (mail) => {
      mails.push(mail);
      return Promise.resolve({ ok: true, value: { messageId: "m1" } });
    },
    now: () => new Date(),
  });

  const recipient = first(
    await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaign.id)),
    "recipient",
  );
  const after = first(
    await db.select().from(campaigns).where(eq(campaigns.id, campaign.id)),
    "campaign after send",
  );
  return { user, person, campaign: after, recipient, mails };
}

export async function eventsFor(db: Db, campaignId: string) {
  return db
    .select()
    .from(campaignEvents)
    .where(eq(campaignEvents.campaignId, campaignId))
    .orderBy(campaignEvents.createdAt);
}
