import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";

const S = INSIGHTS_STRINGS;

// Map a service error id to the 6.2 user copy. Anything unrecognised falls back to the panel's
// generic line rather than printing the raw id at a reader.

const COPY: Record<string, string> = {
  E_INSIGHT_001: S.errors.notFound,
  E_INSIGHT_003: S.errors.queryTimeout,
  E_INSIGHT_004: S.errors.explainUnavailable,
  E_INSIGHT_005: S.errors.forbidden,
};

export function insightErrorMessage(id: string | null | undefined): string {
  if (id === null || id === undefined) return S.ui.error;
  return COPY[id] ?? S.ui.error;
}
