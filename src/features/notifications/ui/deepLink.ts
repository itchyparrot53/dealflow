import type { NotificationType } from "@/constants/notificationTypes";
import { entityHref, payloadHref } from "@/features/notifications/entityHref";
import type { NotificationFeedItem } from "@/types/notification";

// Deep-link resolution for the notifications feed. Every route here resolves through entityHref,
// so no notification type can build a URL out of an entity ref that does not belong to it. The
// per-type entry supplies only the fallback for a row whose ref is missing or not routable.
const FALLBACK: Record<NotificationType, string> = {
  mention: "/",
  activity_assigned: "/activities/calendar",
  activity_reminder: "/activities/calendar",
  deal_followed_update: "/",
  email_open: "/inbox",
  email_click: "/inbox",
  deal_won: "/",
  deal_lost: "/",
  comment_reply: "/",
  // Opens the deal, not the inbox thread: the point of this one is the deal's timeline.
  deal_email_received: "/",
  document_viewed: "/documents",
  document_accepted: "/documents",
  document_declined: "/documents",
  automation: "/settings/automations",
  form_submission: "/settings/forms",
  booking_created: "/settings/booking",
  booking_cancelled: "/settings/booking",
  // The score now shows on the cards and the list; the deals list is where it happened.
  ai_bulk_score: "/deals",
  project_task_assigned: "/projects",
  campaign_click: "/campaigns",
};

// Email notifications point at a thread, which the row carries in its payload rather than as an
// entity ref (entityType is "email_message", the message, not the thread).
function threadHref(item: NotificationFeedItem): string | null {
  const threadId = typeof item.payload.threadId === "string" ? item.payload.threadId : null;
  return threadId !== null ? `/inbox/${threadId}` : null;
}

export function notificationHref(item: NotificationFeedItem): string {
  if (item.type === "email_open" || item.type === "email_click") {
    return threadHref(item) ?? FALLBACK[item.type];
  }
  return (
    payloadHref(item.type, item.payload) ??
    entityHref(item.entityType, item.entityId) ??
    FALLBACK[item.type]
  );
}
