import type { NotificationType } from "./notificationTypes";

// Whether a notification type emails the recipient when they have set no preference.
// On: someone is waiting on you, or the outcome is worth interrupting for. Off: the
// per-event and per-edit types, which fire many times per record and would drown the
// on-by-default ones. In-app delivery defaults to true for every type.
export const DEFAULT_EMAIL_BY_TYPE: Record<NotificationType, boolean> = {
  mention: true,
  comment_reply: true,
  activity_assigned: true,
  activity_reminder: true,
  deal_won: true,
  deal_lost: true,
  deal_followed_update: false,
  email_open: false,
  email_click: false,
  deal_email_received: false,
  // A view is low-value noise; an accept or decline is an outcome worth interrupting for.
  document_viewed: false,
  document_accepted: true,
  document_declined: true,
  // A per-run ping; keep it out of email unless the recipient opts in.
  automation: false,
  // A submission is already in the inbox as a lead or deal; booking changes are the outcome.
  form_submission: false,
  booking_created: true,
  booking_cancelled: true,
  // A job the user started and can watch in the app; in-app delivery is the acknowledgement.
  ai_bulk_score: false,
};

export const DEFAULT_IN_APP = true;
