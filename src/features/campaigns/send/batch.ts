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
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { loadCampaignAssetUrls } from "../assets";
import { campaignMergeValues } from "../blocks/personalize";
import { renderCampaign } from "../blocks/render";
import type { CampaignDocument } from "../blocks/schema";
import type { CampaignSegment } from "../schemas";
import { previewSegment } from "../segment";
import { getCampaignSettings } from "../settings";
import { recordCampaignBounce } from "../tracking/events";
import {
  appendOpenPixel,
  clickTrackingUrl,
  rewriteTrackedHtml,
  rewriteTrackedText,
  trackingOrigin,
} from "../tracking/links";
import { recordCampaignTimeline } from "../tracking/timeline";
import { refreshCampaignTotals } from "../tracking/totals";
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

export type ClaimedRecipient = {
  id: string;
  person_id: string | null;
  email: string;
  email_hash: string;
  token: string | null;
};

export interface CampaignSendContext {
  design: Awaited<ReturnType<typeof getEmailDesign>>;
  postalAddress: string;
  baseUrl: string;
  assetUrls: Map<string, string>;
}

// Freeze the ordered link templates for a campaign. The sequence scheduler reuses this for each
// hidden nurture campaign, so a step email's tracked links redirect exactly like a campaign's.
export async function freezeCampaignLinks(
  tx: DbOrTx,
  campaignId: string,
  document: CampaignDocument,
  ctx: CampaignSendContext,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const sample = renderCampaign(document, {
    design: ctx.design,
    values: templateValues(ctx.baseUrl),
    postalAddress: ctx.postalAddress,
    baseUrl: ctx.baseUrl,
    assetUrl: (assetId) => ctx.assetUrls.get(assetId) ?? null,
  });
  const links = sample.links.filter((url) => {
    const path = new URL(url).pathname;
    return !path.startsWith("/u/") && !path.startsWith("/v/");
  });
  await tx.execute(sql`DELETE FROM campaign_links WHERE campaign_id = ${campaignId}::uuid`);
  if (links.length === 0) return;
  const values = links.map((url, index) => sql`(${campaignId}::uuid, ${index}, ${url})`);
  await tx.execute(sql`
    INSERT INTO campaign_links (campaign_id, link_index, url_template)
    VALUES ${sql.join(values, sql`, `)}
  `);
  signal.throwIfAborted();
}

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
    const assetUrls = await loadCampaignAssetUrls(tx, signal);
    const document = campaign.content as CampaignDocument;
    await freezeCampaignLinks(
      tx,
      campaignId,
      document,
      {
        design,
        postalAddress: settings.postalAddress,
        baseUrl: env.BASE_URL,
        assetUrls,
      },
      signal,
    );

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

// The snapshot stores link TEMPLATES, not one recipient's rendered URL. Substituting each
// variable with its own token keeps the merge field in the stored campaign_links row, so the click
// redirect can render it with the clicking recipient's values (6.4 "tracked by template position").
function templateValues(baseUrl: string): Record<string, string> {
  const base = baseUrl.replace(/\/$/, "");
  return {
    "person.first_name": "{{person.first_name}}",
    "person.last_name": "{{person.last_name}}",
    "person.name": "{{person.name}}",
    "person.email": "{{person.email}}",
    "organization.name": "{{organization.name}}",
    "owner.name": "{{owner.name}}",
    "owner.email": "{{owner.email}}",
    "company.name": "{{company.name}}",
    unsubscribe_url: `${base}/u/preview`,
    web_version_url: `${base}/v/preview`,
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

  const sender = await loadVerifiedCampaignSender(db, campaign.senderId, signal);
  if (sender === null) {
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
      .set({ status: "sent", finishedAt: deps.now() })
      .where(eq(campaigns.id, campaignId));
    await refreshCampaignTotals(db, campaignId, signal);
    return { ok: true, value: { sent, remaining: 0, nextAt: null } };
  }
  await refreshCampaignTotals(db, campaignId, signal);
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

export interface VerifiedSender {
  fromName: string;
  fromEmail: string;
}

export async function loadVerifiedCampaignSender(
  db: Db,
  senderId: string | null,
  signal: AbortSignal,
): Promise<VerifiedSender | null> {
  if (senderId === null) return null;
  const [row] = await db
    .select({
      fromName: campaignSenders.fromName,
      fromEmail: campaignSenders.fromEmail,
      verifiedAt: campaignSenders.verifiedAt,
    })
    .from(campaignSenders)
    .where(eq(campaignSenders.id, senderId))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined || row.verifiedAt === null) return null;
  return { fromName: row.fromName, fromEmail: row.fromEmail };
}

// Send a specific set of already-claimed recipients. The sequence scheduler uses this for a hidden
// step campaign (one recipient), while runCampaignTick keeps owning the claim/throttle loop.
export async function sendCampaignRows(
  db: Db,
  campaign: typeof campaigns.$inferSelect,
  rows: ClaimedRecipient[],
  signal: AbortSignal,
  deps: TickDeps = DEFAULT_DEPS,
): Promise<Result<{ sent: number }, AppError>> {
  if (rows.length === 0) return ok({ sent: 0 });
  const sender = await loadVerifiedCampaignSender(db, campaign.senderId, signal);
  if (sender === null) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_SENDER_UNVERIFIED, "sender is not verified", {}));
  }
  const sent = await deliverRows(db, campaign, rows, sender, deps, signal);
  await refreshCampaignTotals(db, campaign.id, signal);
  return ok({ sent });
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
  const ctx = await loadDeliveryContext(db, campaign.id, rows, signal);
  const document = campaign.content as CampaignDocument;
  const subject = campaignSubject(campaign.subject);
  const base = trackingOrigin(env.BASE_URL);

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
      preheader: campaign.preheader ?? undefined,
      baseUrl: base,
      assetUrl: (assetId) => ctx.assetUrls.get(assetId) ?? null,
    });
    // The footer's /u and /v links are not in rendered.links, so they stay direct; every other
    // http(s) link becomes a tracked redirect. The pixel closes the body.
    const trackedByHref = new Map(
      rendered.links.map((href, index) => [href, clickTrackingUrl(base, token, index)] as const),
    );
    const html =
      token === ""
        ? rendered.html
        : appendOpenPixel(rewriteTrackedHtml(rendered.html, trackedByHref), base, token);
    const text =
      token === ""
        ? rendered.text
        : rewriteTrackedText(rendered.text, ctx.links, values, (index) =>
            clickTrackingUrl(base, token, index),
          );

    const result = await deps.send(
      {
        to: row.email,
        from: `"${sender.fromName}" <${sender.fromEmail}>`,
        subject,
        html,
        text,
        headers: campaignHeaders({
          campaignId: campaign.id,
          recipientId: row.id,
          campaignType: campaign.type,
          baseUrl: base,
          unsubscribeOneClickUrl: `${base}/u/${token}/one-click`,
        }),
      },
      signal,
    );
    if (result.ok) {
      await db.transaction(async (tx) => {
        await tx
          .update(campaignRecipients)
          .set({
            status: "sent",
            sentAt: deps.now(),
            attempts: sql`${campaignRecipients.attempts} + 1`,
          })
          .where(eq(campaignRecipients.id, row.id));
        await tx.insert(campaignEvents).values({
          campaignId: campaign.id,
          recipientId: row.id,
          personId: person.id,
          type: "delivered",
        });
        await recordCampaignTimeline(
          tx,
          { personId: person.id, event: "sent", campaignName: campaign.name },
          signal,
        );
      });
      sent += 1;
      continue;
    }
    await handleFailure(
      db,
      campaign.id,
      campaign.name,
      row,
      person.id,
      result.error.failure,
      signal,
    );
  }
  return sent;
}

interface DeliveryContext {
  peopleById: Map<string, typeof persons.$inferSelect>;
  statusByPerson: Map<string, string>;
  suppressed: Set<string>;
  orgNames: Map<string, string>;
  ownerById: Map<string, { name: string; email: string }>;
  links: Array<{ linkIndex: number; urlTemplate: string }>;
  assetUrls: Map<string, string>;
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

// One read for the tick's batch: people, consent, suppressions, orgs, owners, links, assets and
// the design.
async function loadDeliveryContext(
  db: Db,
  campaignId: string,
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
  const links = await db
    .select({
      linkIndex: campaignLinks.linkIndex,
      urlTemplate: campaignLinks.urlTemplate,
    })
    .from(campaignLinks)
    .where(eq(campaignLinks.campaignId, campaignId));
  const assetUrls = await loadCampaignAssetUrls(db, signal);
  return {
    peopleById: new Map(people.map((person) => [person.id, person])),
    statusByPerson: new Map(statuses.map((row) => [row.personId, row.status])),
    suppressed: new Set(suppressedRows.map((row) => row.emailHash)),
    orgNames: new Map(orgs.map((org) => [org.id, org.name])),
    ownerById: new Map(owners.map((owner) => [owner.id, { name: owner.name, email: owner.email }])),
    links,
    assetUrls,
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
  campaignName: string,
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
    await recordCampaignBounce(
      db,
      { campaignId, recipientId: row.id, personId, campaignName, type: "bounce_hard" },
      signal,
    );
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
  await recordCampaignBounce(
    db,
    { campaignId, recipientId: row.id, personId, campaignName, type: "bounce_soft" },
    signal,
  );
  await db
    .update(personMarketing)
    .set({ softBounceCount: sql`${personMarketing.softBounceCount} + 1` })
    .where(eq(personMarketing.personId, personId));
}
