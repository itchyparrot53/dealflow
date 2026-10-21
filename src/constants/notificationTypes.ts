// Notification kinds delivered in-app. The notifications FEATURE lands in Phase 5;
// this constant exists now because the activity-reminder job (Phase 3) writes rows.
export const NOTIFICATION_TYPES = [
  "mention",
  "activity_assigned",
  "activity_reminder",
  "deal_followed_update",
  "email_open",
  "email_click",
  "deal_won",
  "deal_lost",
  "comment_reply",
  "deal_email_received",
  // Part 4: documents. The recipient is the document creator (or the deal owner).
  "document_viewed",
  "document_accepted",
  "document_declined",
  // Part 5: an automation's notify_user action.
  "automation",
  // Part 6: public web forms and booking pages.
  "form_submission",
  "booking_created",
  "booking_cancelled",
  // Part 7: the bulk AI scoring job finished.
  "ai_bulk_score",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
