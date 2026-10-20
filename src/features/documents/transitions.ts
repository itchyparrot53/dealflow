// The document state machine, pure so the allowed moves are unit-tested and the
// services cannot drift apart. A null result means "not allowed" (E_DOC_003).

export type DocKind = "quote" | "invoice";
export type DocStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "overdue"
  | "paid"
  | "void";
export type DocEvent =
  | "issue"
  | "markSent"
  | "view"
  | "accept"
  | "decline"
  | "overdue"
  | "pay"
  | "unpay"
  | "void";

function quoteNext(from: DocStatus, event: DocEvent): DocStatus | null {
  switch (event) {
    case "issue":
    case "markSent":
      return from === "draft" ? "sent" : null;
    case "view":
      return from === "sent" || from === "viewed" ? "viewed" : null;
    case "accept":
      return from === "sent" || from === "viewed" ? "accepted" : null;
    case "decline":
      return from === "sent" || from === "viewed" ? "declined" : null;
    // Drafts are deleted, not voided; paid and overdue are invoice-only.
    case "overdue":
    case "pay":
    case "unpay":
    case "void":
      return null;
    default:
      return null;
  }
}

function invoiceNext(from: DocStatus, event: DocEvent): DocStatus | null {
  switch (event) {
    case "issue":
    case "markSent":
      return from === "draft" ? "sent" : null;
    // A view only records viewed_at, so the status comes back unchanged.
    case "view":
      return from === "sent" || from === "overdue" ? from : null;
    case "overdue":
      return from === "sent" ? "overdue" : null;
    case "pay":
      return from === "sent" || from === "overdue" ? "paid" : null;
    case "unpay":
      // The service then applies "overdue" when the due date has passed.
      return from === "paid" ? "sent" : null;
    case "void":
      return from === "sent" || from === "overdue" ? "void" : null;
    // Quotes are the only documents that can be accepted or declined.
    case "accept":
    case "decline":
      return null;
    default:
      return null;
  }
}

export function nextStatus(kind: DocKind, from: DocStatus, event: DocEvent): DocStatus | null {
  return kind === "quote" ? quoteNext(from, event) : invoiceNext(from, event);
}
