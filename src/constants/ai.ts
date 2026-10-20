// Budget for the AI actions that call the provider (summary, score, notes to activities, email
// draft, filter). A real model call with one JSON repair retry can take much longer than a plain
// database action, so these get their own 60 s ceiling instead of the 8 s SIG() default.
export const AI_ACTION_TIMEOUT_MS = 60_000;
