import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// 6.8's totals cache. `campaigns.totals` is written by the event writer so the list, the report and
// insights read one row instead of aggregating campaign_events on every page view. Every field is
// an integer count; rates are derived by the report so the divide-by-zero rule lives in one place.

export interface CampaignTotals {
  recipients: number;
  sent: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  uniqueHumanOpens: number;
  machineOpens: number;
  clicks: number;
  uniqueClicks: number;
  unsubscribes: number;
  bouncesHard: number;
  bouncesSoft: number;
  complaints: number;
}

export const EMPTY_CAMPAIGN_TOTALS: CampaignTotals = {
  recipients: 0,
  sent: 0,
  delivered: 0,
  opens: 0,
  uniqueOpens: 0,
  uniqueHumanOpens: 0,
  machineOpens: 0,
  clicks: 0,
  uniqueClicks: 0,
  unsubscribes: 0,
  bouncesHard: 0,
  bouncesSoft: 0,
  complaints: 0,
};

// One statement so a reader never sees a half-written cache. `sent` counts delivered events (a row
// that later hard-bounces still went out), while `delivered` subtracts the final bounce outcomes.
export async function refreshCampaignTotals(
  db: DbOrTx,
  campaignId: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db.execute(sql`
    UPDATE campaigns SET totals = jsonb_build_object(
      'recipients', (
        SELECT count(*) FROM campaign_recipients WHERE campaign_id = ${campaignId}
      ),
      'sent', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'delivered'
      ),
      'delivered', greatest(
        (SELECT count(*) FROM campaign_events
         WHERE campaign_id = ${campaignId} AND type = 'delivered')
        - (SELECT count(*) FROM campaign_events
           WHERE campaign_id = ${campaignId} AND type IN ('bounce_hard','bounce_soft')),
        0
      ),
      'opens', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open'
      ),
      'uniqueOpens', (
        SELECT count(DISTINCT recipient_id) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open'
      ),
      'uniqueHumanOpens', (
        SELECT count(DISTINCT recipient_id) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open'
          AND (user_agent_family IS NULL OR user_agent_family <> 'proxy')
      ),
      'machineOpens', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open' AND user_agent_family = 'proxy'
      ),
      'clicks', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'click'
      ),
      'uniqueClicks', (
        SELECT count(DISTINCT recipient_id) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'click'
      ),
      'unsubscribes', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'unsubscribe'
      ),
      'bouncesHard', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'bounce_hard'
      ),
      'bouncesSoft', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'bounce_soft'
      ),
      'complaints', (
        SELECT count(*) FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'complaint'
      )
    )
    WHERE id = ${campaignId}
  `);
  signal.throwIfAborted();
}

export function asCampaignTotals(value: unknown): CampaignTotals {
  if (typeof value !== "object" || value === null) return EMPTY_CAMPAIGN_TOTALS;
  return { ...EMPTY_CAMPAIGN_TOTALS, ...(value as Partial<CampaignTotals>) };
}
