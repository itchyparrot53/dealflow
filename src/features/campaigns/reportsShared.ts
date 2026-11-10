// Client-safe report vocabulary and rate formulas. The DB reads live in reports.ts; the report
// view imports only this module so no server module (or its pg pool) reaches the browser bundle.

export interface CampaignReportSummary {
  recipients: number;
  sent: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  uniqueOpensAll: number;
  machineOpens: number;
  clicks: number;
  uniqueClicks: number;
  unsubscribes: number;
  bouncesHard: number;
  bouncesSoft: number;
  complaints: number;
}

export interface CampaignReportRates {
  openRate: number | null;
  clickRate: number | null;
  ctor: number | null;
  unsubscribeRate: number | null;
  bounceRate: number | null;
}

export interface CampaignReportSeriesPoint {
  label: string;
  opens: number;
  clicks: number;
}

export interface CampaignReportLink {
  index: number;
  url: string;
  uniqueClicks: number;
  clicks: number;
}

export type CampaignRecipientStatus =
  | "sent"
  | "opened"
  | "clicked"
  | "unsubscribed"
  | "bounced_hard"
  | "bounced_soft"
  | "skipped";

export interface CampaignReportRecipient {
  id: string;
  personId: string | null;
  name: string;
  email: string;
  status: CampaignRecipientStatus;
  lastActivity: string | null;
}

export interface CampaignReport {
  campaign: {
    id: string;
    name: string;
    status: string;
    subject: string;
    startedAt: string | null;
    finishedAt: string | null;
  };
  summary: CampaignReportSummary;
  series: CampaignReportSeriesPoint[];
  seriesKind: "hour" | "day";
  links: CampaignReportLink[];
  recipients: CampaignReportRecipient[];
  recipientTotal: number;
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function campaignRates(
  summary: CampaignReportSummary,
  includeMachineOpens: boolean,
): CampaignReportRates {
  const delivered = Math.max(0, summary.sent - summary.bouncesHard - summary.bouncesSoft);
  const opens = includeMachineOpens ? summary.uniqueOpensAll : summary.uniqueOpens;
  return {
    openRate: ratio(opens, delivered),
    clickRate: ratio(summary.uniqueClicks, delivered),
    ctor: ratio(summary.uniqueClicks, opens),
    unsubscribeRate: ratio(summary.unsubscribes, delivered),
    bounceRate: ratio(summary.bouncesHard + summary.bouncesSoft, delivered),
  };
}

export const RECIPIENT_STATUS_LABELS: Record<CampaignRecipientStatus, string> = {
  sent: "Sent",
  opened: "Opened",
  clicked: "Clicked",
  unsubscribed: "Unsubscribed",
  bounced_hard: "Bounced hard",
  bounced_soft: "Bounced soft",
  skipped: "Skipped",
};
