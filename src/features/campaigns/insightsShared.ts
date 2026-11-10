// Client-safe insight types, averages and arrow comparison. The SQL lives in insights.ts; the
// Insights view imports only this module so no pg client reaches the browser bundle.

export interface InsightRates {
  openRate: number | null;
  clickRate: number | null;
  ctor: number | null;
  unsubscribeRate: number | null;
  bounceRate: number | null;
}

export interface CampaignMetricRow extends InsightRates {
  id: string;
  name: string;
  type: string;
  senderId: string | null;
  senderName: string | null;
  startedAt: string;
  recipients: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
}

export interface SequenceStepMetricRow extends InsightRates {
  sequenceId: string;
  sequenceName: string;
  sequenceStatus: string;
  stepId: string;
  position: number;
  subject: string;
  recipients: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
}

export interface SequenceMetricRow extends InsightRates {
  id: string;
  name: string;
  status: string;
  steps: number;
  recipients: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  bounces: number;
}

export interface InsightSender {
  id: string;
  name: string;
}

export interface CampaignInsights {
  campaigns: CampaignMetricRow[];
  average: InsightRates;
  sequences: SequenceMetricRow[];
  sequenceAverage: InsightRates;
  steps: SequenceStepMetricRow[];
  senders: InsightSender[];
}

export interface InsightFilters {
  since: Date;
  type?: string;
  senderId?: string;
}

const RATE_KEYS = ["openRate", "clickRate", "ctor", "unsubscribeRate", "bounceRate"] as const;

// "Your average" is the unweighted mean of each campaign's rate, not a pooled rate: a small
// campaign with an unusually high open rate is still one row, and the arrow compares to that same
// row set. A metric with no campaign that has a denominator contributes nothing.
export function averageRates(rows: readonly InsightRates[]): InsightRates {
  const out = {} as InsightRates;
  for (const key of RATE_KEYS) {
    const values = rows.map((row) => row[key]).filter((value): value is number => value !== null);
    out[key] =
      values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return out;
}

// Up or down only when the campaign differs from the average by more than 10% relative. A zero
// average has no meaningful reference, so it shows no arrow.
export function compareToAverage(
  value: number | null,
  average: number | null,
): "up" | "down" | null {
  if (value === null || average === null || average === 0) return null;
  const relative = (value - average) / average;
  if (Math.abs(relative) <= 0.1) return null;
  return relative > 0 ? "up" : "down";
}
