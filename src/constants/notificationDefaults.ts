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
  // Someone is waiting on you, so this interrupts by email like the other assignment type.
  project_task_assigned: true,
  // A campaign click is useful in-app engagement signal, but it fires per link and would flood
  // an inbox; the owner opts in to email if they want it.
  campaign_click: false,
};

export const DEFAULT_IN_APP = true;

// Whether a notification type pushes to a device when the user has set no preference. Push is
// more intrusive than email (it lands on the lock screen), so the default is narrower: on for
// someone waiting on you or an outcome worth interrupting for, off for the per-event and per-edit
// types. A missing row always falls back to this map (src/features/push/prefs.ts).
export const DEFAULT_PUSH_BY_TYPE: Record<NotificationType, boolean> = {
  mention: true,
  comment_reply: false,
  activity_assigned: true,
  activity_reminder: false,
  deal_won: false,
  deal_lost: false,
  deal_followed_update: false,
  email_open: false,
  email_click: false,
  deal_email_received: false,
  document_viewed: false,
  document_accepted: true,
  document_declined: false,
  automation: false,
  form_submission: true,
  booking_created: true,
  booking_cancelled: false,
  ai_bulk_score: false,
  project_task_assigned: true,
  campaign_click: false,
};
