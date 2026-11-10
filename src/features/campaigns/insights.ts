import { sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignSenders } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { ratio } from "./reportsShared";

// 6.11's comparative insights: one SQL aggregate per campaign (and per sequence step), then the
// same pure rate and average functions for the table, the arrows and the trend chart.

import {
  averageRates,
  type CampaignInsights,
  type CampaignMetricRow,
  type InsightFilters,
  type InsightRates,
  type SequenceMetricRow,
  type SequenceStepMetricRow,
} from "./insightsShared";

export * from "./insightsShared";

function ratesFromCounts(row: {
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
}): InsightRates {
  return {
    openRate: ratio(row.uniqueOpens, row.delivered),
    clickRate: ratio(row.uniqueClicks, row.delivered),
    ctor: ratio(row.uniqueClicks, row.uniqueOpens),
    unsubscribeRate: ratio(row.unsubscribes, row.delivered),
    bounceRate: ratio(row.bounces, row.delivered),
  };
}

interface RawMetricRow {
  id: string;
  name: string;
  type: string;
  sender_id: string | null;
  sender_name: string | null;
  started_at: Date | string | null;
  recipients: number;
  sent: number;
  unique_opens: number;
  unique_clicks: number;
  unsubscribes: number;
  bounces: number;
}

function deliveredOf(sent: number, bounces: number): number {
  return Math.max(0, sent - bounces);
}

async function queryCampaigns(
  db: Db,
  filters: InsightFilters,
  signal: AbortSignal,
): Promise<CampaignMetricRow[]> {
  const typeFilter = filters.type === undefined ? sql`` : sql` AND c.type = ${filters.type}`;
  const senderFilter =
    filters.senderId === undefined ? sql`` : sql` AND c.sender_id = ${filters.senderId}`;
  const result = await db.execute(sql`
    WITH ev AS (
      SELECT campaign_id,
        count(*) FILTER (WHERE type = 'delivered')::int AS sent,
        count(DISTINCT recipient_id) FILTER (
          WHERE type = 'open' AND (user_agent_family IS NULL OR user_agent_family <> 'proxy')
        )::int AS unique_opens,
        count(DISTINCT recipient_id) FILTER (WHERE type = 'click')::int AS unique_clicks,
        count(*) FILTER (WHERE type = 'unsubscribe')::int AS unsubscribes,
        count(*) FILTER (WHERE type IN ('bounce_hard','bounce_soft'))::int AS bounces
      FROM campaign_events
      GROUP BY campaign_id
    ), rc AS (
      SELECT campaign_id, count(*)::int AS recipients
      FROM campaign_recipients
      GROUP BY campaign_id
    )
    SELECT c.id, c.name, c.type, c.sender_id, s.from_name AS sender_name, c.started_at,
      coalesce(rc.recipients, 0)::int AS recipients,
      coalesce(ev.sent, 0)::int AS sent,
      coalesce(ev.unique_opens, 0)::int AS unique_opens,
      coalesce(ev.unique_clicks, 0)::int AS unique_clicks,
      coalesce(ev.unsubscribes, 0)::int AS unsubscribes,
      coalesce(ev.bounces, 0)::int AS bounces
    FROM campaigns c
    LEFT JOIN campaign_senders s ON s.id = c.sender_id
    LEFT JOIN ev ON ev.campaign_id = c.id
    LEFT JOIN rc ON rc.campaign_id = c.id
    WHERE c.status = 'sent'
      AND coalesce(c.started_at, c.created_at) >= ${filters.since}
      AND NOT EXISTS (SELECT 1 FROM sequence_steps ss WHERE ss.campaign_id = c.id)
      ${typeFilter}
      ${senderFilter}
    ORDER BY c.started_at DESC NULLS LAST
  `);
  signal.throwIfAborted();
  return (result.rows as unknown as RawMetricRow[]).map((row) => {
    const delivered = deliveredOf(row.sent, row.bounces);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      senderId: row.sender_id,
      senderName: row.sender_name,
      startedAt: new Date(row.started_at ?? 0).toISOString(),
      recipients: row.recipients,
      delivered,
      uniqueOpens: row.unique_opens,
      uniqueClicks: row.unique_clicks,
      unsubscribes: row.unsubscribes,
      bounces: row.bounces,
      ...ratesFromCounts({
        delivered,
        uniqueOpens: row.unique_opens,
        uniqueClicks: row.unique_clicks,
        unsubscribes: row.unsubscribes,
        bounces: row.bounces,
      }),
    };
  });
}

interface RawStepRow {
  sequence_id: string;
  sequence_name: string;
  sequence_status: string;
  step_id: string;
  position: number;
  subject: string | null;
  recipients: number;
  sent: number;
  unique_opens: number;
  unique_clicks: number;
  unsubscribes: number;
  bounces: number;
}

async function querySequenceSteps(
  db: Db,
  filters: InsightFilters,
  signal: AbortSignal,
): Promise<{ steps: SequenceStepMetricRow[]; sequences: SequenceMetricRow[] }> {
  const senderFilter =
    filters.senderId === undefined ? sql`` : sql` AND c.sender_id = ${filters.senderId}`;
  const result = await db.execute(sql`
    WITH ev AS (
      SELECT campaign_id,
        count(*) FILTER (WHERE type = 'delivered')::int AS sent,
        count(DISTINCT recipient_id) FILTER (
          WHERE type = 'open' AND (user_agent_family IS NULL OR user_agent_family <> 'proxy')
        )::int AS unique_opens,
        count(DISTINCT recipient_id) FILTER (WHERE type = 'click')::int AS unique_clicks,
        count(*) FILTER (WHERE type = 'unsubscribe')::int AS unsubscribes,
        count(*) FILTER (WHERE type IN ('bounce_hard','bounce_soft'))::int AS bounces
      FROM campaign_events
      GROUP BY campaign_id
    ), rc AS (
      SELECT campaign_id, count(*)::int AS recipients
      FROM campaign_recipients
      GROUP BY campaign_id
    )
    SELECT ss.sequence_id, seq.name AS sequence_name, seq.status AS sequence_status,
      ss.id AS step_id, ss.position, ss.subject,
      coalesce(rc.recipients, 0)::int AS recipients,
      coalesce(ev.sent, 0)::int AS sent,
      coalesce(ev.unique_opens, 0)::int AS unique_opens,
      coalesce(ev.unique_clicks, 0)::int AS unique_clicks,
      coalesce(ev.unsubscribes, 0)::int AS unsubscribes,
      coalesce(ev.bounces, 0)::int AS bounces
    FROM sequence_steps ss
    JOIN sequences seq ON seq.id = ss.sequence_id
    JOIN campaigns c ON c.id = ss.campaign_id
    LEFT JOIN ev ON ev.campaign_id = ss.campaign_id
    LEFT JOIN rc ON rc.campaign_id = ss.campaign_id
    WHERE ss.kind = 'email'
      AND coalesce(c.started_at, c.created_at) >= ${filters.since}
      ${senderFilter}
    ORDER BY seq.name, ss.position
  `);
  signal.throwIfAborted();
  const steps = (result.rows as unknown as RawStepRow[]).map((row) => {
    const delivered = deliveredOf(row.sent, row.bounces);
    return {
      sequenceId: row.sequence_id,
      sequenceName: row.sequence_name,
      sequenceStatus: row.sequence_status,
      stepId: row.step_id,
      position: row.position,
      subject: row.subject ?? "Email",
      recipients: row.recipients,
      delivered,
      uniqueOpens: row.unique_opens,
      uniqueClicks: row.unique_clicks,
      unsubscribes: row.unsubscribes,
      bounces: row.bounces,
      ...ratesFromCounts({
        delivered,
        uniqueOpens: row.unique_opens,
        uniqueClicks: row.unique_clicks,
        unsubscribes: row.unsubscribes,
        bounces: row.bounces,
      }),
    };
  });
  const bySequence = new Map<string, SequenceMetricRow>();
  for (const step of steps) {
    const current = bySequence.get(step.sequenceId) ?? {
      id: step.sequenceId,
      name: step.sequenceName,
      status: step.sequenceStatus,
      steps: 0,
      recipients: 0,
      delivered: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
      unsubscribes: 0,
      bounces: 0,
      openRate: null,
      clickRate: null,
      ctor: null,
      unsubscribeRate: null,
      bounceRate: null,
    };
    current.steps += 1;
    current.recipients += step.recipients;
    current.delivered += step.delivered;
    current.uniqueOpens += step.uniqueOpens;
    current.uniqueClicks += step.uniqueClicks;
    current.unsubscribes += step.unsubscribes;
    current.bounces += step.bounces;
    bySequence.set(step.sequenceId, current);
  }
  const sequences = [...bySequence.values()].map((row) => ({
    ...row,
    ...ratesFromCounts(row),
  }));
  return { steps, sequences };
}

export async function getCampaignInsights(
  db: Db,
  actor: PermSetUser,
  filters: InsightFilters,
  signal: AbortSignal,
): Promise<Result<CampaignInsights, AppError>> {
  if (!can(actor, "campaigns.view")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "campaigns.view required", { userId: actor.id }),
    );
  }
  const [campaigns, sequenceData, senders] = await Promise.all([
    queryCampaigns(db, filters, signal),
    querySequenceSteps(db, filters, signal),
    db
      .select({ id: campaignSenders.id, name: campaignSenders.fromName })
      .from(campaignSenders)
      .orderBy(campaignSenders.fromName),
  ]);
  signal.throwIfAborted();
  return ok({
    campaigns,
    average: averageRates(campaigns),
    sequences: sequenceData.sequences,
    sequenceAverage: averageRates(sequenceData.sequences),
    steps: sequenceData.steps,
    senders,
  });
}
