// Part 14 consent vocabulary. Kept out of the drizzle schema so client components (the status
// chip, the change dialog) can import the values and labels without pulling drizzle into the
// browser bundle.

export const MARKETING_STATUSES = [
  "not_subscribed",
  "pending",
  "subscribed",
  "unsubscribed",
  "bounced",
] as const;

export type MarketingStatus = (typeof MARKETING_STATUSES)[number];

export const MARKETING_STATUS_LABELS: Record<MarketingStatus, string> = {
  not_subscribed: "Not subscribed",
  pending: "Pending",
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
};

export const CONSENT_SOURCES = [
  "manual",
  "bulk",
  "import",
  "form",
  "double_opt_in",
  "unsubscribe_link",
  "one_click",
  "preference_page",
  "bounce",
  "complaint",
  "system",
] as const;

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const CONSENT_BASES = [
  "double_opt_in",
  "form_consent",
  "explicit",
  "legitimate_interest",
  "imported",
] as const;

export type ConsentBasis = (typeof CONSENT_BASES)[number];

export const CONSENT_BASIS_LABELS: Record<ConsentBasis, string> = {
  double_opt_in: "Double opt-in",
  form_consent: "Form consent",
  explicit: "Explicit consent",
  legitimate_interest: "Legitimate interest",
  imported: "Imported",
};

// The bases a manual or bulk change may claim when it subscribes someone directly. Double opt-in
// and form consent are evidence only the corresponding flow can produce.
export const MANUAL_SUBSCRIBE_BASES = [
  "explicit",
  "legitimate_interest",
  "imported",
] as const satisfies readonly ConsentBasis[];

export const SUPPRESSION_REASONS = ["unsubscribed", "hard_bounce", "complaint"] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export type MarketingTokenPurpose = "doi" | "unsub" | "sender";

// Timings fixed by 6.3 and 6.9. Constants, not settings, because the plan fixes them.
export const DOI_TOKEN_TTL_DAYS = 30;
export const SENDER_TOKEN_TTL_HOURS = 48;
export const DOI_RESEND_WINDOW_HOURS = 24;
export const DEFAULT_CAMPAIGN_DOI_DAILY_LIMIT = 500;
