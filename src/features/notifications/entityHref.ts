// Single source of truth for "where does a notification's entity ref open?".
//
// Notification rows are polymorphic (entityType names a table, entityId a row), and the ref does
// NOT always name a routable record: reminders carry their activity's parent, email notifications
// carry the message. Deriving a URL from the entity type by string manipulation is what produced
// /activitys/<id> and /deals/<activityId>, both of which render Not found. Callers get null for a
// ref with no detail page and choose their own fallback.
//
// A document notification's entity ref is its DEAL (the visibility parent, so the
// recipient gate can use the shared deal predicate), while the routable record is
// the document. payloadHref resolves that case before entityHref is consulted.
import type { NotificationType } from "@/constants/notificationTypes";

const DOCUMENT_TYPES: ReadonlySet<NotificationType> = new Set([
  "document_viewed",
  "document_accepted",
  "document_declined",
]);

export function payloadHref(
  type: NotificationType,
  payload: Record<string, unknown>,
): string | null {
  if (!DOCUMENT_TYPES.has(type)) return null;
  const documentId = typeof payload.documentId === "string" ? payload.documentId : null;
  return documentId === null ? null : `/documents/${documentId}`;
}

export function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (entityType === null || entityId === null) return null;
  switch (entityType) {
    case "deal":
      return `/deals/${entityId}`;
    case "person":
      return `/contacts/people/${entityId}`;
    case "organization":
      return `/contacts/orgs/${entityId}`;
    case "lead":
      return `/leads/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    // "activity" and "email_message" are deliberately absent: neither has a detail route.
    default:
      return null;
  }
}
