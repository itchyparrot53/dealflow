// Part 7 Insights limits. They are shared by the definition schema, the engine and the UI so a
// limit is stated once.

/** Groups beyond this roll into "Other". */
export const INSIGHT_MAX_GROUPS = 50;

/** Segments beyond this roll into "Other". */
export const INSIGHT_MAX_SEGMENTS = 12;

/** A report table never renders more rows than this; the result also carries `truncated`. */
export const INSIGHT_TABLE_MAX_ROWS = 500;

/** The explain prompt carries at most this many aggregated rows. */
export const INSIGHT_EXPLAIN_MAX_ROWS = 60;

/** One bulk scoring request may name at most this many deals. */
export const BULK_SCORE_MAX = 200;

/** Server-side statement timeout for one report query. */
export const REPORT_QUERY_TIMEOUT_MS = 15_000;
