import { sql } from "drizzle-orm";
import { CHANGE_FIELD_CAMPAIGN_EVENT } from "@/constants/changeLogFields";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// 6.8's person timeline entries. They live in the existing change_logs table so the contact page's
// All and Email filters pick them up with no second feed. The insert is deliberately direct rather
// than through recordChange: that helper emits a `person.updated` domain event, and an open or a
// click is engagement evidence, not a CRM mutation that automations should react to.

export type CampaignTimelineEvent =
  | "sent"
  | "open"
  | "click"
  | "unsubscribe"
  | "bounce_hard"
  | "bounce_soft";

export interface CampaignTimelineInput {
  personId: string;
  event: CampaignTimelineEvent;
  campaignName: string;
  // The clicked URL's host, used only by the click wording.
  linkHost?: string | null;
}

export function campaignTimelineLabel(input: CampaignTimelineInput): string {
  switch (input.event) {
    case "sent":
      return `Campaign sent: ${input.campaignName}`;
    case "open":
      return `Opened ${input.campaignName}`;
    case "click":
      return `Clicked ${input.linkHost ?? "a link"} in ${input.campaignName}`;
    case "unsubscribe":
      return `Unsubscribed via ${input.campaignName}`;
    case "bounce_hard":
      return "Bounced (hard)";
    case "bounce_soft":
      return "Bounced (soft)";
  }
}

export async function recordCampaignTimeline(
  tx: DbOrTx,
  input: CampaignTimelineInput,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const value = JSON.stringify({
    label: campaignTimelineLabel(input),
    event: input.event,
    campaignName: input.campaignName,
  });
  await tx.execute(sql`
    INSERT INTO change_logs (entity_type, entity_id, field, old_value, new_value, actor_id)
    VALUES ('person', ${input.personId}::uuid, ${CHANGE_FIELD_CAMPAIGN_EVENT}, NULL, ${value}::jsonb, NULL)
  `);
  signal.throwIfAborted();
}
