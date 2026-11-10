import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { campaigns, persons } from "@/db/schema";
import { toVisibleRecord } from "@/features/contacts/personsRepo";
import { csvLine } from "@/features/export/csv";
import { can } from "@/features/permissions/can";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";

// 6.11's campaign report. Counts come from SQL over campaign_events and campaign_recipients;
// people visibility is applied once, in the recipient read, so the table and the CSV cannot leak a
// contact the viewer may not open.

import {
  type CampaignRecipientStatus,
  type CampaignReport,
  type CampaignReportLink,
  type CampaignReportRecipient,
  type CampaignReportSeriesPoint,
  type CampaignReportSummary,
  RECIPIENT_STATUS_LABELS,
} from "./reportsShared";

export * from "./reportsShared";

async function loadSummary(db: Db, campaignId: string, signal: AbortSignal) {
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM campaign_recipients WHERE campaign_id = ${campaignId}) AS recipients,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'delivered') AS sent,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'open') AS opens,
      (SELECT count(DISTINCT recipient_id)::int FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open') AS unique_opens_all,
      (SELECT count(DISTINCT recipient_id)::int FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open'
          AND (user_agent_family IS NULL OR user_agent_family <> 'proxy')) AS unique_opens,
      (SELECT count(*)::int FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'open' AND user_agent_family = 'proxy') AS machine_opens,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'click') AS clicks,
      (SELECT count(DISTINCT recipient_id)::int FROM campaign_events
        WHERE campaign_id = ${campaignId} AND type = 'click') AS unique_clicks,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'unsubscribe') AS unsubscribes,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'bounce_hard') AS bounces_hard,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'bounce_soft') AS bounces_soft,
      (SELECT count(*)::int FROM campaign_events WHERE campaign_id = ${campaignId} AND type = 'complaint') AS complaints
  `);
  signal.throwIfAborted();
  const row = result.rows[0] as
    | {
        recipients: number;
        sent: number;
        opens: number;
        unique_opens_all: number;
        unique_opens: number;
        machine_opens: number;
        clicks: number;
        unique_clicks: number;
        unsubscribes: number;
        bounces_hard: number;
        bounces_soft: number;
        complaints: number;
      }
    | undefined;
  const value = row ?? {
    recipients: 0,
    sent: 0,
    opens: 0,
    unique_opens_all: 0,
    unique_opens: 0,
    machine_opens: 0,
    clicks: 0,
    unique_clicks: 0,
    unsubscribes: 0,
    bounces_hard: 0,
    bounces_soft: 0,
    complaints: 0,
  };
  const summary: CampaignReportSummary = {
    recipients: value.recipients,
    sent: value.sent,
    delivered: Math.max(0, value.sent - value.bounces_hard - value.bounces_soft),
    opens: value.opens,
    uniqueOpens: value.unique_opens,
    uniqueOpensAll: value.unique_opens_all,
    machineOpens: value.machine_opens,
    clicks: value.clicks,
    uniqueClicks: value.unique_clicks,
    unsubscribes: value.unsubscribes,
    bouncesHard: value.bounces_hard,
    bouncesSoft: value.bounces_soft,
    complaints: value.complaints,
  };
  return summary;
}

async function loadSeries(
  db: Db,
  campaignId: string,
  startedAt: Date,
  now: Date,
  signal: AbortSignal,
): Promise<{ kind: "hour" | "day"; points: CampaignReportSeriesPoint[] }> {
  const kind = now.getTime() - startedAt.getTime() <= 48 * 60 * 60 * 1000 ? "hour" : "day";
  const count = kind === "hour" ? 48 : 30;
  const stepMs = kind === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  // Align the first bucket to the database's date_trunc output; an event after a half-hour start
  // would otherwise land in a negative index.
  const windowStart = new Date(startedAt.getTime());
  if (kind === "hour") windowStart.setUTCMinutes(0, 0, 0);
  else windowStart.setUTCHours(0, 0, 0, 0);
  const end = new Date(windowStart.getTime() + count * stepMs);
  const bucket = kind === "hour" ? "hour" : "day";
  const result = await db.execute(sql`
    SELECT date_trunc(${sql.raw(`'${bucket}'`)}, created_at) AS bucket,
      count(*) FILTER (WHERE type = 'open')::int AS opens,
      count(*) FILTER (WHERE type = 'click')::int AS clicks
    FROM campaign_events
    WHERE campaign_id = ${campaignId}
      AND type IN ('open','click')
      AND created_at >= ${windowStart}
      AND created_at < ${end}
    GROUP BY bucket
    ORDER BY bucket
  `);
  signal.throwIfAborted();
  const points: CampaignReportSeriesPoint[] = Array.from({ length: count }, (_, index) => ({
    label: new Date(windowStart.getTime() + index * stepMs).toISOString(),
    opens: 0,
    clicks: 0,
  }));
  for (const row of result.rows as unknown as {
    bucket: Date | string;
    opens: number;
    clicks: number;
  }[]) {
    const at = new Date(row.bucket).getTime();
    const index = Math.floor((at - windowStart.getTime()) / stepMs);
    const point = points[index];
    if (point !== undefined) {
      point.opens = row.opens;
      point.clicks = row.clicks;
    }
  }
  return { kind, points };
}

async function loadLinks(
  db: Db,
  campaignId: string,
  signal: AbortSignal,
): Promise<CampaignReportLink[]> {
  const result = await db.execute(sql`
    SELECT l.link_index, l.url_template,
      count(e.id)::int AS clicks,
      count(DISTINCT e.recipient_id)::int AS unique_clicks
    FROM campaign_links l
    LEFT JOIN campaign_events e
      ON e.campaign_id = l.campaign_id
      AND e.type = 'click'
      AND e.link_index = l.link_index
    WHERE l.campaign_id = ${campaignId}
    GROUP BY l.link_index, l.url_template
    ORDER BY count(e.id) DESC, l.link_index
  `);
  signal.throwIfAborted();
  return (
    result.rows as unknown as {
      link_index: number;
      url_template: string;
      clicks: number;
      unique_clicks: number;
    }[]
  ).map((row) => ({
    index: row.link_index,
    url: row.url_template,
    uniqueClicks: row.unique_clicks,
    clicks: row.clicks,
  }));
}

function statusOf(row: {
  status: string;
  clicked: boolean;
  opened: boolean;
  unsubscribed: boolean;
  complained: boolean;
}): CampaignRecipientStatus {
  if (row.status === "bounced_hard") return "bounced_hard";
  if (row.status === "failed_soft") return "bounced_soft";
  if (row.status.startsWith("skipped")) return "skipped";
  if (row.unsubscribed || row.complained) return "unsubscribed";
  if (row.clicked) return "clicked";
  if (row.opened) return "opened";
  return "sent";
}

export async function getCampaignRecipients(
  db: Db,
  actor: PermSetUser,
  campaignId: string,
  signal: AbortSignal,
): Promise<{ rows: CampaignReportRecipient[]; total: number }> {
  const result = await db.execute(sql`
    SELECT r.id, r.person_id, r.email, r.status, r.sent_at,
      max(e.created_at) AS last_activity,
      coalesce(bool_or(e.type = 'click'), false) AS clicked,
      coalesce(bool_or(e.type = 'open'), false) AS opened,
      coalesce(bool_or(e.type = 'unsubscribe'), false) AS unsubscribed,
      coalesce(bool_or(e.type = 'complaint'), false) AS complained
    FROM campaign_recipients r
    LEFT JOIN campaign_events e ON e.recipient_id = r.id
    WHERE r.campaign_id = ${campaignId}
    GROUP BY r.id
    ORDER BY max(e.created_at) DESC NULLS LAST, r.created_at ASC
  `);
  signal.throwIfAborted();
  const raw = result.rows as unknown as {
    id: string;
    person_id: string | null;
    email: string;
    status: string;
    sent_at: Date | string | null;
    last_activity: Date | string | null;
    clicked: boolean;
    opened: boolean;
    unsubscribed: boolean;
    complained: boolean;
  }[];
  const personIds = raw
    .map((row) => row.person_id)
    .filter((value): value is string => value !== null);
  const people =
    personIds.length === 0
      ? []
      : await db.select().from(persons).where(inArray(persons.id, personIds));
  signal.throwIfAborted();
  const personById = new Map(people.map((person) => [person.id, person]));
  const rows: CampaignReportRecipient[] = [];
  for (const row of raw) {
    const person = row.person_id === null ? undefined : personById.get(row.person_id);
    // A deleted person has no visibility record to check; their historical recipient row stays
    // visible to the campaign viewer. A live person must pass the people visibility rule.
    if (person !== undefined && !canSee(actor, toVisibleRecord(person))) continue;
    rows.push({
      id: row.id,
      personId: row.person_id,
      name: person?.name ?? "Deleted contact",
      email: row.email,
      status: statusOf(row),
      lastActivity:
        row.last_activity === null
          ? row.sent_at === null
            ? null
            : new Date(row.sent_at).toISOString()
          : new Date(row.last_activity).toISOString(),
    });
  }
  return { rows, total: rows.length };
}

export async function getCampaignReport(
  db: Db,
  actor: PermSetUser,
  campaignId: string,
  signal: AbortSignal,
  now: Date = new Date(),
): Promise<CampaignReport | null> {
  if (!can(actor, "campaigns.view")) return null;
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  signal.throwIfAborted();
  if (campaign === undefined) return null;
  if (!["sending", "paused", "sent"].includes(campaign.status)) return null;

  const startedAt = campaign.startedAt ?? campaign.createdAt;
  const [summary, series, links, recipients] = await Promise.all([
    loadSummary(db, campaignId, signal),
    loadSeries(db, campaignId, startedAt, now, signal),
    loadLinks(db, campaignId, signal),
    getCampaignRecipients(db, actor, campaignId, signal),
  ]);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      subject: campaign.subject,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      finishedAt: campaign.finishedAt?.toISOString() ?? null,
    },
    summary,
    series: series.points,
    seriesKind: series.kind,
    links,
    recipients: recipients.rows.slice(0, 2000),
    recipientTotal: recipients.total,
  };
}

export function campaignRecipientsCsv(recipients: readonly CampaignReportRecipient[]): string {
  const lines = [csvLine(["Person", "Email", "Status", "Last activity"])];
  for (const recipient of recipients) {
    lines.push(
      csvLine([
        recipient.name,
        recipient.email,
        RECIPIENT_STATUS_LABELS[recipient.status],
        recipient.lastActivity ?? "",
      ]),
    );
  }
  return lines.join("");
}
