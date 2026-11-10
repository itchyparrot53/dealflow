import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import {
  campaignRecipients,
  campaignSenders,
  campaigns,
  personMarketing,
  persons,
} from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedUser } from "@/db/testing/factories";
import type { SystemMail } from "@/features/mailer/types";
import type { PermSetUser } from "@/features/permissions/effective";
import { CAMPAIGN_STARTERS } from "./blocks/starters";
import { runCampaignTick, snapshotCampaign } from "./send/batch";
import { cancelCampaign } from "./send/state";

const signal = new AbortController().signal;

function admin(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

async function setup(db: Parameters<Parameters<typeof withTestDb>[0]>[0], status = "subscribed") {
  const user = await seedUser(db);
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
  await db.insert(personMarketing).values({ personId: person!.id, status: status as never });
  const [sender] = await db
    .insert(campaignSenders)
    .values({ fromName: "Northwind News", fromEmail: "news@example.com", verifiedAt: new Date() })
    .returning();
  const [campaign] = await db
    .insert(campaigns)
    .values({
      name: "Launch",
      type: "announcement",
      subject: "Something new",
      senderId: sender!.id,
      createdBy: user.id,
      content: CAMPAIGN_STARTERS[1]!.document,
      segment: {
        kind: "definition",
        definition: {
          combinator: "and",
          conditions: [{ field: "name", op: "contains", value: "Person" }],
        },
      },
    })
    .returning();
  return { user, person: person!, campaign: campaign! };
}

type FakeSend = (
  mail: SystemMail,
) => Promise<
  | { ok: true; value: { messageId: string } }
  | { ok: false; error: { failure: "hard" | "soft"; detail: string } }
>;

describe("campaign sending engine", () => {
  it("snapshots recipients and sends once with the campaign headers", async () => {
    await withTestDb(async (db) => {
      const { campaign } = await setup(db);
      const snapshot = await snapshotCampaign(db, campaign.id, signal);
      expect(snapshot.ok).toBe(true);
      if (!snapshot.ok) return;
      expect(snapshot.recipients).toBe(1);

      const mails: SystemMail[] = [];
      const send: FakeSend = (mail) => {
        mails.push(mail);
        return Promise.resolve({ ok: true, value: { messageId: "m1" } });
      };
      const tick = await runCampaignTick(db, campaign.id, signal, {
        send,
        now: () => new Date(),
      });
      expect(tick.ok).toBe(true);
      if (!tick.ok) return;
      expect(tick.value.sent).toBe(1);
      expect(tick.value.remaining).toBe(0);

      const [recipient] = await db.select().from(campaignRecipients);
      expect(recipient?.status).toBe("sent");
      const token = recipient?.token ?? "";
      const base = env.BASE_URL.replace(/\/$/, "");

      const headers = mails[0]?.headers ?? {};
      expect(headers["List-Unsubscribe"]).toBe(`<${base}/u/${token}/one-click>`);
      expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      expect(headers["Message-ID"]).toMatch(
        new RegExp(`^<${campaign.id}\\.[0-9a-f-]+@app\\.example\\.com>$`),
      );
      expect(mails[0]?.subject).toBe("Something new");

      const html = mails[0]?.html ?? "";
      expect(html).toContain("Unsubscribe");
      expect(html).toContain(`/t/c/l/${token}/0`);
      expect(html).toContain(`/t/c/o/${token}.gif`);
      // The footer keeps the direct unsubscribe and web-version links.
      expect(html).toContain(`href="${base}/u/${token}"`);
      expect(html).toContain(`href="${base}/v/${token}"`);
      expect(mails[0]?.text ?? "").toContain(`/t/c/l/${token}/0`);

      const [after] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
      expect(after?.status).toBe("sent");
    });
  });

  it("never sends the same recipient twice under two concurrent ticks", async () => {
    await withTestDb(async (db) => {
      const { campaign } = await setup(db);
      await snapshotCampaign(db, campaign.id, signal);
      let sends = 0;
      const send: FakeSend = async () => {
        sends += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { ok: true, value: { messageId: "m" } };
      };
      await Promise.all([
        runCampaignTick(db, campaign.id, signal, { send, now: () => new Date() }),
        runCampaignTick(db, campaign.id, signal, { send, now: () => new Date() }),
      ]);
      expect(sends).toBe(1);
    });
  });

  it("marks a hard failure as a bounce and updates consent", async () => {
    await withTestDb(async (db) => {
      const { campaign, person } = await setup(db);
      await snapshotCampaign(db, campaign.id, signal);
      const send: FakeSend = () =>
        Promise.resolve({ ok: false, error: { failure: "hard", detail: "status 550" } });
      await runCampaignTick(db, campaign.id, signal, { send, now: () => new Date() });
      const [recipient] = await db.select().from(campaignRecipients);
      expect(recipient?.status).toBe("bounced_hard");
      const [marketing] = await db
        .select()
        .from(personMarketing)
        .where(eq(personMarketing.personId, person.id));
      expect(marketing?.status).toBe("bounced");
    });
  });

  it("retries a soft failure and gives up after three attempts", async () => {
    await withTestDb(async (db) => {
      const { campaign } = await setup(db);
      await snapshotCampaign(db, campaign.id, signal);
      const send: FakeSend = () =>
        Promise.resolve({ ok: false, error: { failure: "soft", detail: "status 421" } });

      await runCampaignTick(db, campaign.id, signal, { send, now: () => new Date() });
      let [recipient] = await db.select().from(campaignRecipients);
      expect(recipient?.status).toBe("queued");
      expect(recipient?.attempts).toBe(1);

      // Clear the backoff so the next tick can claim it again.
      await db.update(campaignRecipients).set({ retryAt: null });
      await runCampaignTick(db, campaign.id, signal, { send, now: () => new Date() });
      [recipient] = await db.select().from(campaignRecipients);
      expect(recipient?.attempts).toBe(2);

      await db.update(campaignRecipients).set({ retryAt: null });
      await runCampaignTick(db, campaign.id, signal, { send, now: () => new Date() });
      [recipient] = await db.select().from(campaignRecipients);
      expect(recipient?.status).toBe("failed_soft");
    });
  });

  it("cancels a sending campaign and skips its queued recipients", async () => {
    await withTestDb(async (db) => {
      const { campaign, user } = await setup(db);
      await snapshotCampaign(db, campaign.id, signal);
      const result = await cancelCampaign(db, admin(user.id), campaign.id, signal);
      expect(result.ok).toBe(true);
      const [after] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
      expect(after?.status).toBe("cancelled");
      const [recipient] = await db.select().from(campaignRecipients);
      expect(recipient?.status).toBe("skipped_cancelled");
    });
  });
});
