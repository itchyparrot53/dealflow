// Part 9 productivity constants (6.1). Kept in one module so the toast, recurrence, bulk and
// shortcut code cannot drift apart.

export const TOAST_UNDO_MS = 8000;
export const TOAST_MAX = 3;
export const RECURRENCE_MAX_COUNT = 500;
export const RECURRENCE_MAX_INTERVAL = 99;
export const DUPLICATE_PAGE_SIZE = 50;
export const BULK_MAX = 500;
export const SHORTCUT_SEQUENCE_MS = 1200;

export const CALL_OUTCOMES = [
  "connected",
  "no_answer",
  "left_voicemail",
  "busy",
  "wrong_number",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_DIRECTIONS = ["outbound", "inbound"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];
