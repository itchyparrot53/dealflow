import { env } from "@/config/env";
import { entityHref, payloadHref } from "@/features/notifications/entityHref";
import type { NotificationRow } from "@/types/notification";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

function wrap(line: string, link: string): { text: string; html: string } {
  const text = `${line}\n\nOpen: ${link}`;
  const html = `<p>${escapeHtml(line)}</p><p><a href="${escapeHtml(link)}">Open in Dealflow</a></p>`;
  return { text, html };
}

function payloadString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

// The three document types share one copy builder so the main switch stays under
// the cognitive-complexity cap.
function documentEmailCopy(
  row: NotificationRow,
  recipientName: string,
): { subject: string; line: string } {
  const fallbackTitle = row.type === "document_viewed" ? "a document" : "a quote";
  const title = payloadString(row.payload.title, fallbackTitle);
  if (row.type === "document_viewed") {
    const customer = payloadString(row.payload.customer, "Someone");
    return {
      subject: `Document viewed: ${title}`,
      line: `${recipientName}, ${customer} viewed ${title}.`,
    };
  }
  if (row.type === "document_accepted") {
    const name = payloadString(row.payload.name, "the customer");
    return {
      subject: `Quote accepted: ${title}`,
      line: `${recipientName}, ${name} accepted ${title}.`,
    };
  }
  return {
    subject: `Quote declined: ${title}`,
    line: `${recipientName}, ${title} was declined.`,
  };
}

// Per-type copy strings. No em dashes; no magic strings duplicated.
export function renderNotificationEmail(
  row: NotificationRow,
  recipientName: string,
): { subject: string; text: string; html: string } {
  const base = env.BASE_URL;
  // Never derive the path from the entity type: pluralizing it produced /activitys/<id>,
  // /persons/<id> and /organizations/<id>, none of which are routes in this app.
  const path = payloadHref(row.type, row.payload) ?? entityHref(row.entityType, row.entityId);
  const link = path !== null ? `${base}${path}` : base;

  let subject: string;
  let line: string;

  switch (row.type) {
    case "mention":
      subject = "Somebody mentioned you in Dealflow";
      line = `${recipientName}, somebody mentioned you.`;
      break;
    case "activity_assigned":
      subject = "An activity was assigned to you in Dealflow";
      line = `${recipientName}, an activity was assigned to you.`;
      break;
    case "activity_reminder": {
      const activitySubject =
        typeof row.payload.subject === "string" ? row.payload.subject : "activity";
      subject = `Reminder: ${activitySubject} is due soon`;
      line = `${recipientName}, your activity "${activitySubject}" is due soon.`;
      break;
    }
    case "deal_followed_update":
      subject = "A deal you follow has an update";
      line = `${recipientName}, a deal you are following has been updated.`;
      break;
    case "email_open":
      subject = "Your email was opened";
      line = `${recipientName}, someone opened your email.`;
      break;
    case "email_click":
      subject = "A link in your email was clicked";
      line = `${recipientName}, someone clicked a link in your email.`;
      break;
    case "deal_won":
      subject = "Deal won!";
      line = `${recipientName}, a deal was marked as won.`;
      break;
    case "deal_lost":
      subject = "Deal lost";
      line = `${recipientName}, a deal was marked as lost.`;
      break;
    case "comment_reply":
      subject = "Someone replied to your comment in Dealflow";
      line = `${recipientName}, somebody replied to your comment.`;
      break;
    case "deal_email_received": {
      const emailSubject = typeof row.payload.subject === "string" ? row.payload.subject : null;
      subject =
        emailSubject !== null ? `New email on a deal: ${emailSubject}` : "New email on a deal";
      line = `${recipientName}, a new email arrived on a deal you follow.`;
      break;
    }
    case "automation": {
      subject = "Automation notification";
      const message = typeof row.payload.message === "string" ? row.payload.message : null;
      line = message ?? `${recipientName}, an automation ran on a deal you own.`;
      break;
    }
    case "document_viewed":
    case "document_accepted":
    case "document_declined": {
      const copy = documentEmailCopy(row, recipientName);
      subject = copy.subject;
      line = copy.line;
      break;
    }
    default: {
      // Unknown future type: render a generic fallback. Never throw (pg-boss resilience).
      subject = "Dealflow notification";
      line = `${recipientName}, you have a new notification.`;
    }
  }

  const { text, html } = wrap(line, link);
  return { subject, text, html };
}
