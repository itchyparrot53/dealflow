// Automations and webhooks limits. Kept here so the runner, dispatcher, delivery job and UI
// cannot disagree about a cap, and so a future settings screen has one place to read.

/** Hard stop for an event chain: an automation may not trigger itself more than this deep. */
export const AUTOMATION_MAX_DEPTH = 3;

/** A definition may carry at most this many actions (6.7). */
export const AUTOMATION_MAX_ACTIONS = 10;

/** One webhook request may take this long before it counts as a failed attempt. */
export const WEBHOOK_TIMEOUT_MS = 10_000;

/** Backoff between retries, in seconds, indexed by the attempt that just failed (1-based). */
export const WEBHOOK_RETRY_SECONDS = [60, 300, 1800, 7200, 21600] as const;

/** Consecutive failed deliveries after which a subscription disables itself. */
export const WEBHOOK_DISABLE_AFTER = 10;

/** Cap on how much of a receiver's response body we read before destroying the socket. */
export const WEBHOOK_MAX_RESPONSE_BYTES = 65_536;

/** Processed domain events older than this are deleted by the retention job. */
export const EVENT_RETENTION_DAYS = 30;

/** Finished runs and deliveries older than this are deleted by the retention job. */
export const RUN_RETENTION_DAYS = 90;

/** Events one dispatcher pass claims at a time. */
export const DISPATCH_BATCH = 100;

/** How often the worker polls the outbox when no LISTEN notification arrives. */
export const DISPATCH_POLL_SECONDS = 5;

/** A send_email action may email the same person at most once per window per automation. */
export const EMAIL_ACTION_COOLDOWN_HOURS = 24;

/** Postgres channel the dispatcher LISTENs on; emit sends `NOTIFY` on it after commit. */
export const DOMAIN_EVENTS_CHANNEL = "dealflow_domain_events";
