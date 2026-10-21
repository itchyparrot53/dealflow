// The shape every report run returns (6.6). It lives on its own so the CSV encoder, the chart
// components and the engine agree on one type without importing the engine.

export interface ReportRow {
  /** Group key: the stage id, owner id, bucket key like "2026-10", or "" when ungrouped. */
  g: string;
  gLabel: string;
  /** Segment key, or null when the report has no segment. */
  s: string | null;
  sLabel: string | null;
  /** Money in the base currency, a count, or minutes, always as a decimal string. */
  value: string;
  count: number;
}

export interface ReportExcludedCurrency {
  currency: string;
  count: number;
}

export interface FunnelStage {
  stageId: string;
  name: string;
  order: number;
  reached: number;
  conversion: number;
  medianDaysInStage: number | null;
}

export interface ReportResult {
  baseCurrency: string;
  measure: string;
  rows: ReportRow[];
  total: { value: string; count: number };
  /** Currencies with no stored rate. Their deals are left out, never added unconverted. */
  excluded: ReportExcludedCurrency[];
  /** True when the result was capped (groups, segments or table rows). */
  truncated: boolean;
  generatedAt: string;
  /** Present only for a funnel report; rows mirror these stages. */
  funnel?: FunnelStage[];
}
