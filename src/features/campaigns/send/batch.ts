import { and, eq, inArray, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  campaignEvents,
  campaignLinks,
  campaignRecipients,
  campaignSenders,
  campaigns,
  marketingSuppressions,
  marketingTokens,
  organizations,
  personMarketing,
  persons,
  users,
} from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { transitionMarketingStatus } from "@/features/marketing/service";
import { hashEmail } from "@/features/marketing/suppression";
import { mintMarketingToken } from "@/features/marketing/tokens";
import { hydrateActor } from "@/server/hydrateActor";
import { campaignMergeValues } from "../blocks/personalize";
import { renderCampaign } from "../blocks/render";
import type { CampaignDocument } from "../blocks/schema";
import type { CampaignSegment } from "../schemas";
import { previewSegment } from "../segment";
import { getCampaignSettings } from "../settings";
import { campaignHeaders, campaignSubject } from "./headers";
import { sendCampaignMail } from "./transport";

// 6.7's sending engine: freeze a snapshot once, then claim recipients in batches with
// `FOR UPDATE SKIP LOCKED`, so two ticks can never send the same row twice.

const RATE_WINDOW_MS = 60_000;
const BACKOFF_MINUTES = [5, 30, 120];

export interface TickDeps {
  send: typeof sendCampaignMail;
  now: () => Date;
}

const DEFAULT_DEPS: TickDeps = { send: sendCampaignMail, now: () => new Date() };

export interface TickResult {
  sent: number;
  remaining: number;
  // When the next tick should run (rate throttled), or null when the campaign is done.
  nextAt: Date | null;
}

export async function snapshotCampaign(
  db: Db,
  campaignId: string,
  signal: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<{ ok: true; recipients: number } | { ok: false; error: AppError }> {
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (campaign === undefined) {
      return {
        ok: false as const,
        error: new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", {}),
      };
    }
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return {
        ok: false as const,
        error: new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "campaign cannot start", {}),
      };
    }
    if (campaign.content === null || campaign.segment === null) {
      return {
        ok: false as const,
        error: new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "content or recipients missing", {}),
      };
    }
    const creatorId = campaign.sendAsUserId ?? campaign.createdBy;
    if (creatorId === null) {
      return {
        ok: false as const,
        error: new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "campaign has no creator", {}),
      };
    }
    const actor = await hydrateActor(tx, creatorId, signal);
    if (actor === null) {
      return {
        ok: false as const,
        error: new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "campaign creator is gone", {}),
      };
    }
    const preview = await previewSegment(tx, actor, campaign.segment as CampaignSegment, signal);
    if (!preview.ok) return { ok: false as const, error: preview.error };

    const design = await getEmailDesign(tx, signal);
    const settings = await getCampaignSettings(tx, signal);
    const document = campaign.content as CampaignDocument;
    const sample = renderCampaign(document, {
      design,
      values: sampleValues(design.displayName),
      postalAddress: settings.postalAddress,
      baseUrl: env.BASE_URL,
      assetUrl: () => null,
    });
    // The footer links are per-recipient credentials, never tracked campaign links.
    const links = sample.links.filter((url) => {
      const path = new URL(url).pathname;
      return !path.startsWith("/u/") && !path.startsWith("/v/");
    });

    await tx.delete(campaignLinks).where(eq(campaignLinks.campaignId, campaignId));
    if (links.length > 0) {
      await tx
        .insert(campaignLinks)
        .values(links.map((urlTemplate, linkIndex) => ({ campaignId, linkIndex, urlTemplate })));
    }

    let inserted = 0;
    for (const person of preview.value.eligible) {
      const minted = mintMarketingToken();
      const [recipient] = await tx
        .insert(campaignRecipients)
        .values({
          campaignId,
          personId: person.id,
          email: person.email,
          emailHash: hashEmail(person.email),
          token: minted.token,
          tokenHash: minted.tokenHash,
        })
        .onConflictDoNothing({
          target: [campaignRecipients.campaignId, campaignRecipients.emailHash],
        })
        .returning({ id: campaignRecipients.id });
      if (recipient === undefined) continue;
      inserted += 1;
      await tx.insert(marketingTokens).values({
        tokenHash: minted.tokenHash,
        purpose: "unsub",
        personId: person.id,
        campaignRecipientId: recipient.id,
      });
    }

    await tx
      .update(campaigns)
      .set({
        status: "sending",
        sendAsUserId: creatorId,
        startedAt: now(),
        totals: { recipients: inserted, sent: 0 },
      })
      .where(eq(campaigns.id, campaignId));
    return { ok: true as const, recipients: inserted };
  });
}

function sampleValues(companyName: string): Record<string, string> {
  return {
    "person.first_name": "there",
    "person.last_name": "",
    "person.name": "",
    "person.email": "",
    "organization.name": "",
    "owner.name": "",
    "owner.email": "",
    "company.name": companyName,
    unsubscribe_url: `${env.BASE_URL}/u/preview`,
    web_version_url: `${env.BASE_URL}/v/preview`,
  };
}

export async function runCampaignTick(
  db: Db,
  campaignId: string,
  signal: AbortSignal,
  deps: TickDeps = DEFAULT_DEPS,
): Promise<{ ok: true; value: TickResult } | { ok: false; error: AppError }> {
  const now = deps.now();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (campaign === undefined) {
    return {
      ok: false,
      error: new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", {}),
    };
  }
  if (campaign.status !== "sending") {
    return { ok: true, value: { sent: 0, remaining: 0, nextAt: null } };
  }
  const settings = await getCampaignSettings(db, signal);
  const rate = Math.min(settings.sendRatePerMinute, env.CAMPAIGN_SEND_RATE_PER_MINUTE);
  const windowStart = campaign.rateWindowStartedAt;
  let sentThisWindow = campaign.rateSentCount;
  if (windowStart === null || now.getTime() - windowStart.getTime() >= RATE_WINDOW_MS) {
    sentThisWindow = 0;
    await db
      .update(campaigns)
      .set({ rateWindowStartedAt: now, rateSentCount: 0 })
      .where(eq(campaigns.id, campaignId));
  } else if (sentThisWindow >= rate) {
    const remaining = await queuedCount(db, campaignId);
    return {
      ok: true,
      value: {
        sent: 0,
        remaining,
        nextAt: new Date(windowStart.getTime() + RATE_WINDOW_MS),
      },
    };
  }

  const [sender] =
    campaign.senderId === null
      ? []
      : await db
          .select({
            fromName: campaignSenders.fromName,
            fromEmail: campaignSenders.fromEmail,
            verifiedAt: campaignSenders.verifiedAt,
          })
          .from(campaignSenders)
          .where(eq(campaignSenders.id, campaign.senderId))
          .limit(1);
  if (sender === undefined || sender.verifiedAt === null) {
    return {
      ok: false,
      error: new AppError(ERROR_IDS.CAMPAIGN_SENDER_UNVERIFIED, "sender is not verified", {}),
    };
  }

  const claimed = await db.execute(sql`
    UPDATE campaign_recipients SET status = 'sending'
    WHERE id IN (
      SELECT id FROM campaign_recipients
      WHERE campaign_id = ${campaignId}
        AND status = 'queued'
        AND (retry_at IS NULL OR retry_at <= ${now})
      ORDER BY created_at
      LIMIT ${Math.max(1, Math.min(env.CAMPAIGN_BATCH_SIZE, rate - sentThisWindow))}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, person_id, email, email_hash, token
  `);
  const rows = claimed.rows as unknown as Array<{
    id: string;
    person_id: string | null;
    email: string;
    email_hash: string;
    token: string | null;
  }>;

  const sent = await deliverRows(db, campaign, rows, sender, deps, signal);
  await db
    .update(campaigns)
    .set({ rateSentCount: sql`${campaigns.rateSentCount} + ${sent}` })
    .where(eq(campaigns.id, campaignId));

  const remaining = await queuedCount(db, campaignId);
  if (remaining === 0) {
    await db
      .update(campaigns)
      .set({
        status: "sent",
        finishedAt: deps.now(),
        totals: sql`jsonb_set(jsonb_set(coalesce(${campaigns.totals}, '{}'::jsonb), '{sent}', to_jsonb(${campaign.rateSentCount + sent}::int)), '{recipients}', to_jsonb((SELECT count(*) FROM campaign_recipients WHERE campaign_id = ${campaignId})::int))`,
      })
      .where(eq(campaigns.id, campaignId));
    return { ok: true, value: { sent, remaining: 0, nextAt: null } };
  }
  return {
    ok: true,
    value: {
      sent,
      remaining,
      nextAt: new Date(now.getTime() + RATE_WINDOW_MS / Math.max(1, rate)),
    },
  };
}

async function queuedCount(db: Db, campaignId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        // A retry-scheduled row still means the campaign is not finished.
        eq(campaignRecipients.status, "queued"),
      ),
    );
  return row?.count ?? 0;
}

interface ClaimedRecipient {
  id: string;
  person_id: string | null;
  email: string;
  email_hash: string;
  token: string | null;
}

async function deliverRows(
  db: Db,
  campaign: typeof campaigns.$inferSelect,
  rows: ClaimedRecipient[],
  sender: { fromName: string; fromEmail: string },
  deps: TickDeps,
  signal: AbortSignal,
): Promise<number> {
  if (rows.length === 0) return 0;
  const ctx = await loadDeliveryContext(db, rows, signal);
  const document = campaign.content as CampaignDocument;
  const subject = campaignSubject(campaign.subject);
  const base = env.BASE_URL.replace(/\/$/, "");

  let sent = 0;
  for (const row of rows) {
    signal.throwIfAborted();
    const person = row.person_id === null ? undefined : ctx.peopleById.get(row.person_id);
    const skipReason = skipReasonFor(row, person, ctx.statusByPerson, ctx.suppressed);
    if (skipReason !== null || person === undefined) {
      await skip(db, row.id, skipReason ?? "skipped_status");
      continue;
    }
    const token = row.token ?? "";
    const unsubscribeUrl = `${base}/u/${token}`;
    const webVersionUrl = `${base}/v/${token}`;
    const values = campaignMergeValues({
      person: {
        firstName: person.firstName,
        lastName: person.lastName,
        name: person.name,
        email: person.primaryEmail,
      },
      organization: person.orgId === null ? null : { name: ctx.orgNames.get(person.orgId) ?? "" },
      owner: ctx.ownerById.get(person.ownerId) ?? null,
      companyName: ctx.design.displayName,
      unsubscribeUrl,
      webVersionUrl,
    });
    const rendered = renderCampaign(document, {
      design: ctx.design,
      values,
      postalAddress: ctx.postalAddress,
      baseUrl: base,
      assetUrl: () => null,
    });
    const result = await deps.send(
      {
        to: row.email,
        from: `"${sender.fromName}" <${sender.fromEmail}>`,
        subject,
        html: rendered.html,
        text: rendered.text,
        headers: campaignHeaders({
          campaignId: campaign.id,
          recipientId: row.id,
          campaignType: campaign.type,
          baseUrl: base,
          unsubscribeUrl,
        }),
      },
      signal,
    );
    if (result.ok) {
      await db
        .update(campaignRecipients)
        .set({
          status: "sent",
          sentAt: deps.now(),
          attempts: sql`${campaignRecipients.attempts} + 1`,
        })
        .where(eq(campaignRecipients.id, row.id));
      await db.insert(campaignEvents).values({
        campaignId: campaign.id,
        recipientId: row.id,
        personId: person.id,
        type: "delivered",
      });
      sent += 1;
      continue;
    }
    await handleFailure(db, campaign.id, row, person.id, result.error.failure, signal);
  }
  return sent;
}

interface DeliveryContext {
  peopleById: Map<string, typeof persons.$inferSelect>;
  statusByPerson: Map<string, string>;
  suppressed: Set<string>;
  orgNames: Map<string, string>;
  ownerById: Map<string, { name: string; email: string }>;
  design: Awaited<ReturnType<typeof getEmailDesign>>;
  postalAddress: string;
}

function skipReasonFor(
  row: ClaimedRecipient,
  person: typeof persons.$inferSelect | undefined,
  statusByPerson: Map<string, string>,
  suppressed: Set<string>,
): "skipped_status" | "skipped_suppressed" | null {
  if (
    person === undefined ||
    (statusByPerson.get(person.id) ?? "not_subscribed") !== "subscribed"
  ) {
    return "skipped_status";
  }
  return suppressed.has(row.email_hash) ? "skipped_suppressed" : null;
}

// One read for the tick's batch: people, consent, suppressions, orgs, owners and the design.
async function loadDeliveryContext(
  db: Db,
  rows: ClaimedRecipient[],
  signal: AbortSignal,
): Promise<DeliveryContext> {
  const personIds = rows.map((row) => row.person_id).filter((id): id is string => id !== null);
  const people =
    personIds.length === 0
      ? []
      : await db.select().from(persons).where(inArray(persons.id, personIds));
  const statuses =
    personIds.length === 0
      ? []
      : await db
          .select({ personId: personMarketing.personId, status: personMarketing.status })
          .from(personMarketing)
          .where(inArray(personMarketing.personId, personIds));
  const suppressedRows = await db
    .select({ emailHash: marketingSuppressions.emailHash })
    .from(marketingSuppressions)
    .where(
      inArray(
        marketingSuppressions.emailHash,
        rows.map((row) => row.email_hash),
      ),
    );
  const orgIds = people.map((person) => person.orgId).filter((id): id is string => id !== null);
  const orgs =
    orgIds.length === 0
      ? []
      : await db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, orgIds));
  const ownerIds = [...new Set(people.map((person) => person.ownerId))];
  const owners =
    ownerIds.length === 0
      ? []
      : await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, ownerIds));
  const design = await getEmailDesign(db, signal);
  const settings = await getCampaignSettings(db, signal);
  return {
    peopleById: new Map(people.map((person) => [person.id, person])),
    statusByPerson: new Map(statuses.map((row) => [row.personId, row.status])),
    suppressed: new Set(suppressedRows.map((row) => row.emailHash)),
    orgNames: new Map(orgs.map((org) => [org.id, org.name])),
    ownerById: new Map(owners.map((owner) => [owner.id, { name: owner.name, email: owner.email }])),
    design,
    postalAddress: settings.postalAddress,
  };
}

async function skip(
  db: Db,
  recipientId: string,
  status: "skipped_status" | "skipped_suppressed",
): Promise<void> {
  await db.update(campaignRecipients).set({ status }).where(eq(campaignRecipients.id, recipientId));
}

async function handleFailure(
  db: Db,
  campaignId: string,
  row: ClaimedRecipient,
  personId: string,
  failure: "hard" | "soft",
  signal: AbortSignal,
): Promise<void> {
  if (failure === "hard") {
    await db
      .update(campaignRecipients)
      .set({ status: "bounced_hard" })
      .where(eq(campaignRecipients.id, row.id));
    await db
      .insert(campaignEvents)
      .values({ campaignId, recipientId: row.id, personId, type: "bounce_hard" });
    await transitionMarketingStatus(
      db,
      { personId, to: "bounced", source: "bounce", campaignId },
      signal,
    );
    return;
  }
  const [current] = await db
    .select({ attempts: campaignRecipients.attempts })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.id, row.id));
  const attempts = (current?.attempts ?? 0) + 1;
  if (attempts < 3) {
    const retryAt = new Date(Date.now() + (BACKOFF_MINUTES[attempts - 1] ?? 120) * 60_000);
    await db
      .update(campaignRecipients)
      .set({ status: "queued", attempts, retryAt })
      .where(eq(campaignRecipients.id, row.id));
    return;
  }
  await db
    .update(campaignRecipients)
    .set({ status: "failed_soft", attempts })
    .where(eq(campaignRecipients.id, row.id));
  await db
    .insert(campaignEvents)
    .values({ campaignId, recipientId: row.id, personId, type: "bounce_soft" });
  await db
    .update(personMarketing)
    .set({ softBounceCount: sql`${personMarketing.softBounceCount} + 1` })
    .where(eq(personMarketing.personId, personId));
}
