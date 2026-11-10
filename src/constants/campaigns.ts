// Part 14 campaign vocabulary. Client components (the list, the editor, the report) import these
// instead of the drizzle schema, so no server module reaches the browser bundle.

export const CAMPAIGN_TYPES = [
  "newsletter",
  "announcement",
  "promotion",
  "event",
  "nurture",
  "other",
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  newsletter: "Newsletter",
  announcement: "Announcement",
  promotion: "Promotion",
  event: "Event",
  nurture: "Nurture",
  other: "Other",
};

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "sent",
  "cancelled",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  paused: "Paused",
  sent: "Sent",
  cancelled: "Cancelled",
};

export const CAMPAIGN_RECIPIENT_STATUSES = [
  "queued",
  "sending",
  "sent",
  "bounced_hard",
  "failed_soft",
  "skipped_status",
  "skipped_suppressed",
  "skipped_cancelled",
] as const;

export type CampaignRecipientStatus = (typeof CAMPAIGN_RECIPIENT_STATUSES)[number];

export const CAMPAIGN_EVENT_TYPES = [
  "open",
  "click",
  "unsubscribe",
  "bounce_hard",
  "bounce_soft",
  "complaint",
  "delivered",
] as const;

export type CampaignEventType = (typeof CAMPAIGN_EVENT_TYPES)[number];

export const SEQUENCE_STATUSES = ["draft", "active", "paused"] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const SEQUENCE_STEP_KINDS = ["email", "wait"] as const;
export type SequenceStepKind = (typeof SEQUENCE_STEP_KINDS)[number];

export const SEQUENCE_ENROLLMENT_STATUSES = ["active", "completed", "exited", "failed"] as const;
export type SequenceEnrollmentStatus = (typeof SEQUENCE_ENROLLMENT_STATUSES)[number];

// Section 6.10 limits. Constants because the plan fixes them, not defaults to tune.
export const SEQUENCE_MAX_STEPS = 20;
export const SEQUENCE_MAX_WAIT_DAYS = 90;

export const CAMPAIGN_HTML_WARN_BYTES = 90 * 1024;
export const CAMPAIGN_HTML_LIMIT_BYTES = 100 * 1024;
