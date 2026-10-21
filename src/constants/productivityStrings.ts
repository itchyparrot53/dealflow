import { BULK_MAX, type CallDirection, type CallOutcome } from "./productivity";

// User-visible copy for the Part 9 surfaces (6.2). Error IDs live in errorIds.ts; the sentence a
// person reads lives here.

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: "Connected",
  no_answer: "No answer",
  left_voicemail: "Left voicemail",
  busy: "Busy",
  wrong_number: "Wrong number",
};

export const CALL_DIRECTION_LABELS: Record<CallDirection, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
};

export const RECURRENCE_FREQUENCY_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
} as const;

export const RECURRENCE_WEEKDAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
} as const;

export const RECURRENCE_END_LABELS = {
  never: "Never ends",
  until: "Ends on",
  count: "Ends after",
} as const;

export const PRODUCTIVITY_STRINGS = {
  recurrenceInvalid: "That repeat rule isn't valid.",
  recurrenceMissing: "That repeating series no longer exists.",
  callNoType: "Add a Call activity type in Settings before logging a call.",
  callInvalid: "That call could not be saved.",
  duplicateMissing: "That pair is no longer available.",
  bulkTooMany: `Select at most ${String(BULK_MAX)} records at once.`,
  bulkPartial: "Some records could not be changed.",
  orgParentLoop: "That would make the organization its own parent.",
  toastDismiss: "Dismiss",
  undoFailed: "Couldn't undo: the record changed since.",
} as const;
