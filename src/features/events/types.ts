// The domain event vocabulary. Everything that emits, dispatches, matches a trigger or
// documents a webhook reads its type from this one list, so a new event cannot be spelled
// differently in two places.

export const DOMAIN_EVENT_TYPES = [
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "deal.deleted",
  "deal.rotting",
  "person.created",
  "person.updated",
  // Part 14: consent. Emitted inside the transition transaction.
  "person.marketing_status_changed",
  "organization.created",
  "organization.updated",
  "activity.created",
  "activity.completed",
  "document.sent",
  "document.viewed",
  "document.accepted",
  "document.declined",
  "invoice.overdue",
  "invoice.paid",
  "invoice.voided",
  // Part 6: public web forms and booking pages.
  "form.submitted",
  "booking.created",
  "booking.cancelled",
  // Part 8: projects and their tasks.
  "project.created",
  "project.status_changed",
  "project.deleted",
  "project_task.completed",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

// The record an event is about. `document` and `invoice` share the documents table but stay
// separate types because their event names and triggers differ.
export const DOMAIN_ENTITY_TYPES = [
  "deal",
  "person",
  "organization",
  "activity",
  "document",
  "invoice",
  // Part 6: a form submission is about the lead or deal it created, and a booking is about its
  // activity (or the person, once the activity is gone).
  "lead",
] as const;

export type DomainEntityType = (typeof DOMAIN_ENTITY_TYPES)[number];

export interface EventChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface DomainEventDraft {
  type: DomainEventType;
  // Text on purpose: audited paths carry the wider EntityType union, and only the types with
  // event rules in eventTypesForChange ever reach the emitter.
  entityType: string;
  entityId: string;
  actorId: string | null;
  changes?: EventChange[];
}

export interface DomainEventRowShape {
  id: number;
  type: DomainEventType;
  entityType: DomainEntityType;
  entityId: string;
  actorId: string | null;
  changes: EventChange[];
  txid: number;
  chainId: string;
  depth: number;
  automationId: string | null;
  createdAt: Date;
}
