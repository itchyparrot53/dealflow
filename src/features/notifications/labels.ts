import type { NotificationType } from "@/constants/notificationTypes";
import { STRINGS } from "@/constants/strings";

// The one-line text of a notification, shared by the in-app feed and the push payload so both
// always say the same thing.
const L = STRINGS.notifications.labels;

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

const LABEL: Record<NotificationType, (p: Record<string, unknown>) => string> = {
  mention: (p) =>
    `${L.mention}${typeof p.title === "string" && p.title.length > 0 ? ` in ${p.title}` : ""}`,
  activity_assigned: (p) => `${L.activity_assigned}: ${toStr(p.subject)}`,
  activity_reminder: (p) => `${L.activity_reminder}: ${toStr(p.subject)}`,
  deal_followed_update: (p) =>
    `${L.deal_followed_update}: ${toStr(p.changeSummary) || L.deal_followed_update_fallback}`,
  email_open: () => L.email_open,
  email_click: () => L.email_click,
  deal_won: () => L.deal_won,
  deal_lost: () => L.deal_lost,
  comment_reply: () => L.comment_reply,
  deal_email_received: (p) =>
    `${L.deal_email_received}: ${toStr(p.subject) || L.deal_email_received_fallback}`,
  document_viewed: (p) => `${toStr(p.customer)} viewed ${toStr(p.title)}`,
  document_accepted: (p) => `${toStr(p.name)} accepted ${toStr(p.title)}`,
  document_declined: (p) => `${toStr(p.title)} was declined`,
  automation: (p) => `${L.automation}: ${toStr(p.message)}`,
  form_submission: (p) => `${L.form_submission}: ${toStr(p.formName) || toStr(p.name)}`,
  booking_created: (p) => `${toStr(p.name)} booked ${toStr(p.pageTitle)}`,
  booking_cancelled: (p) => `${toStr(p.name)} cancelled ${toStr(p.pageTitle)}`,
  ai_bulk_score: (p) => `${L.ai_bulk_score}: ${toStr(p.message)}`,
  project_task_assigned: (p) =>
    `${L.project_task_assigned}: ${toStr(p.taskTitle) || toStr(p.projectName)}`,
};

export function notificationLabel(
  type: NotificationType,
  payload: Record<string, unknown>,
): string {
  return LABEL[type](payload);
}
