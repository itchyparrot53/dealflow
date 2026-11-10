import { and, eq, sql } from "drizzle-orm";
import { env } from "@/config/env";
import type { Db } from "@/db/client";
import {
  campaignEvents,
  campaignLinks,
  campaignRecipients,
  campaigns,
  organizations,
  persons,
  users,
} from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { findMarketingTokenByValue } from "@/features/marketing/tokens";
import { createNotification } from "@/features/notifications/produce";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { campaignMergeValues, renderMerge } from "../blocks/personalize";
import { isMachineOpen, linkHost, safeRedirectTarget, userAgentFamily } from "./links";
import { recordCampaignTimeline } from "./timeline";
import { refreshCampaignTotals } from "./totals";

// 6.8's event writer. Opens, clicks, unsubscribes and bounces all land in campaign_events, refresh
// the campaign totals cache and (when the recipient is still a person) add one timeline row.
// Public routes call these best-effort: a tracking failure must never break a pixel or a redirect.

interface TrackingContext {
  recipientId: string;
  campaignId: string;
  personId: string | null;
  recipientEmail: string;
  sentAt: Date | null;
  campaignName: string;
  personName: string;
  ownerId: string | null;
  values: Record<string, string>;
}

async function loadTrackingContext(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<TrackingContext | null> {
  const tokenRow = await findMarketingTokenByValue(db, token, signal);
  if (tokenRow === null || tokenRow.campaignRecipientId === null) return null;

  const [row] = await db
    .select({
      recipientId: campaignRecipients.id,
      campaignId: campaignRecipients.campaignId,
      personId: campaignRecipients.personId,
      recipientEmail: campaignRecipients.email,
      sentAt: campaignRecipients.sentAt,
      campaignName: campaigns.name,
    })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(eq(campaignRecipients.id, tokenRow.campaignRecipientId))
    .limit(1);
  if (row === undefined) return null;

  const [person] =
    row.personId === null
      ? []
      : await db.select().from(persons).where(eq(persons.id, row.personId)).limit(1);
  const orgId = person?.orgId ?? null;
  const [org] =
    orgId === null
      ? []
      : await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);
  const ownerId = person?.ownerId ?? null;
  const [owner] =
    ownerId === null
      ? []
      : await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, ownerId))
          .limit(1);
  const design = await getEmailDesign(db, signal);
  const base = env.BASE_URL.replace(/\/$/, "");

  return {
    recipientId: row.recipientId,
    campaignId: row.campaignId,
    personId: row.personId,
    recipientEmail: row.recipientEmail,
    sentAt: row.sentAt,
    campaignName: row.campaignName,
    personName: person?.name ?? row.recipientEmail,
    ownerId: owner?.id ?? null,
    values: campaignMergeValues({
      person: {
        firstName: person?.firstName ?? null,
        lastName: person?.lastName ?? null,
        name: person?.name ?? "",
        email: person?.primaryEmail ?? null,
      },
      organization: org === undefined ? null : { name: org.name },
      owner: owner === undefined ? null : { name: owner.name, email: owner.email },
      companyName: design.displayName,
      unsubscribeUrl: `${base}/u/${token}`,
      webVersionUrl: `${base}/v/${token}`,
    }),
  };
}

export async function recordCampaignOpen(
  db: Db,
  token: string,
  userAgent: string | null,
  signal: AbortSignal,
  now: Date = new Date(),
): Promise<boolean> {
  const ctx = await loadTrackingContext(db, token, signal);
  if (ctx === null) return false;
  const machine = isMachineOpen(userAgent, ctx.sentAt, now);
  await db.transaction(async (tx) => {
    await tx.insert(campaignEvents).values({
      campaignId: ctx.campaignId,
      recipientId: ctx.recipientId,
      personId: ctx.personId,
      type: "open",
      userAgentFamily: machine ? "proxy" : userAgentFamily(userAgent),
    });
    if (ctx.personId !== null) {
      await recordCampaignTimeline(
        tx,
        { personId: ctx.personId, event: "open", campaignName: ctx.campaignName },
        signal,
      );
    }
    await refreshCampaignTotals(tx, ctx.campaignId, signal);
  });
  return true;
}

interface ResolvedClick extends TrackingContext {
  target: string;
}

async function resolveClick(
  db: Db,
  token: string,
  linkIndex: number,
  signal: AbortSignal,
): Promise<ResolvedClick | null> {
  if (!Number.isInteger(linkIndex) || linkIndex < 0) return null;
  const ctx = await loadTrackingContext(db, token, signal);
  if (ctx === null) return null;
  const [link] = await db
    .select({ urlTemplate: campaignLinks.urlTemplate })
    .from(campaignLinks)
    .where(
      and(eq(campaignLinks.campaignId, ctx.campaignId), eq(campaignLinks.linkIndex, linkIndex)),
    )
    .limit(1);
  if (link === undefined) return null;
  const target = safeRedirectTarget(renderMerge(link.urlTemplate, ctx.values, "html"));
  return target === null ? null : { ...ctx, target };
}

// The over-rate-limit path: resolve the stored target without writing an event.
export async function resolveCampaignClickTarget(
  db: Db,
  token: string,
  linkIndex: number,
  signal: AbortSignal,
): Promise<string | null> {
  const resolved = await resolveClick(db, token, linkIndex, signal);
  return resolved?.target ?? null;
}

export async function recordCampaignClick(
  db: Db,
  token: string,
  linkIndex: number,
  userAgent: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  const resolved = await resolveClick(db, token, linkIndex, signal);
  if (resolved === null) return null;

  await db.transaction(async (tx) => {
    await tx.insert(campaignEvents).values({
      campaignId: resolved.campaignId,
      recipientId: resolved.recipientId,
      personId: resolved.personId,
      type: "click",
      linkIndex,
      userAgentFamily: userAgentFamily(userAgent),
    });
    if (resolved.personId !== null) {
      await recordCampaignTimeline(
        tx,
        {
          personId: resolved.personId,
          event: "click",
          campaignName: resolved.campaignName,
          linkHost: linkHost(resolved.target),
        },
        signal,
      );
    }
    await refreshCampaignTotals(tx, resolved.campaignId, signal);
  });

  // The alert is best effort and uses its own short timeout: a failure must never stop the
  // recipient reaching the link they clicked.
  await notifyClickOwner(db, resolved).catch((error: unknown) => {
    console.warn("campaign click notification failed", {
      campaignId: resolved.campaignId,
      error,
    });
  });
  return resolved.target;
}

async function notifyClickOwner(db: Db, click: ResolvedClick): Promise<void> {
  if (click.ownerId === null || click.personId === null) return;
  await createNotification(
    db,
    {
      recipientId: click.ownerId,
      type: "campaign_click",
      entityType: "person",
      entityId: click.personId,
      actorId: null,
      payload: {
        personId: click.personId,
        personName: click.personName,
        campaignId: click.campaignId,
        campaignName: click.campaignName,
        linkHost: linkHost(click.target),
      },
    },
    AbortSignal.timeout(3_000),
  );
}

export interface CampaignBounceInput {
  campaignId: string;
  recipientId: string;
  personId: string | null;
  campaignName: string;
  type: "bounce_hard" | "bounce_soft";
  userAgentFamily?: string | null;
}

export async function recordCampaignBounce(
  db: Db,
  input: CampaignBounceInput,
  signal: AbortSignal,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(campaignEvents).values({
      campaignId: input.campaignId,
      recipientId: input.recipientId,
      personId: input.personId,
      type: input.type,
      userAgentFamily: input.userAgentFamily ?? null,
    });
    if (input.personId !== null) {
      await recordCampaignTimeline(
        tx,
        { personId: input.personId, event: input.type, campaignName: input.campaignName },
        signal,
      );
    }
    await refreshCampaignTotals(tx, input.campaignId, signal);
  });
}

export interface CampaignUnsubscribeInput {
  campaignId: string;
  recipientId: string;
  personId: string;
  campaignName: string;
}

// Runs in the unsubscribe transaction so the consent event and the campaign event commit together.
export async function recordCampaignUnsubscribe(
  tx: DbOrTx,
  input: CampaignUnsubscribeInput,
  signal: AbortSignal,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO campaign_events (campaign_id, recipient_id, person_id, type)
    VALUES (${input.campaignId}::uuid, ${input.recipientId}::uuid, ${input.personId}::uuid, 'unsubscribe')
  `);
  await recordCampaignTimeline(
    tx,
    { personId: input.personId, event: "unsubscribe", campaignName: input.campaignName },
    signal,
  );
  await refreshCampaignTotals(tx, input.campaignId, signal);
}
