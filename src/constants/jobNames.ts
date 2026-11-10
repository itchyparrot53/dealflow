// pg-boss queue names and scheduling constants.
export const PGBOSS_QUEUE_ACTIVITY_REMINDER = "activity.reminder";

// Minutes before an activity's dueAt that the reminder fires.
export const REMINDER_LEAD_MINUTES = 10;

// Email job queues are FIXED names (NOT per-account). Per-mailbox identity goes in the
// job DATA + singletonKey=accountId (dedups re-enqueues), so one queue serves all
// mailboxes and per-mailbox isolation is structural (each job is independent).
export const PGBOSS_QUEUE_EMAIL_SYNC = "email.sync";
export const PGBOSS_QUEUE_EMAIL_SEND = "email.send.process";

// IMAP mailbox jobs: the backfill walks older mail in windows (payload { accountId }), and the
// append job retries Sent copies that did not land (no payload; scans mail_sent_appends).
export const PGBOSS_QUEUE_MAIL_BACKFILL = "mail.backfill";
export const PGBOSS_QUEUE_MAIL_APPEND = "mail.append-sent";

// Retry budget for transient Gmail failures (429/5xx) before a job is parked.
export const EMAIL_JOB_RETRY_LIMIT = 8;

// Hourly reaper that clears files rows stuck in status='uploading' plus their
// orphaned MinIO objects. Fixed queue name, cron-scheduled.
export const PGBOSS_QUEUE_FILE_REAPER = "file.reaper";

// Notification email delivery: payload is { notificationId: string }.
// Task 7 registers the worker that consumes this queue.
export const EMAIL_NOTIFICATION_QUEUE = "notification.email";

// Web push delivery: payload is { notificationId: string }. Best-effort; a failed push never
// fails the notification that produced it.
export const PUSH_DELIVERY_QUEUE = "push.deliver";

// Self-hoster update check: poll GitHub for the latest release and cache it. Fixed queue name,
// cron-scheduled (see RELEASE_CHECK_CRON) plus one immediate run on worker boot. No payload.
export const PGBOSS_QUEUE_RELEASE_CHECK = "release.check";

// Daily overdue-invoice sweep: marks sent invoices past their due date overdue.
// Fixed queue name, cron-scheduled at 06:00 UTC. No payload.
export const PGBOSS_QUEUE_DOCUMENT_OVERDUE = "documents.overdue";

// Import overhaul: four background phases, each its own queue (payload { batchId }),
// deduped by singletonKey = batchId.
export const PGBOSS_QUEUE_IMPORT_PREPARE = "import.prepare";
export const PGBOSS_QUEUE_IMPORT_VALIDATE = "import.validate";
export const PGBOSS_QUEUE_IMPORT_COMMIT = "import.commit";
export const PGBOSS_QUEUE_IMPORT_UNDO = "import.undo";
export const IMPORT_JOB_TIMEOUT_MS = 5 * 60 * 1000;

// Part 5 event backbone. The dispatcher polls every DISPATCH_POLL_SECONDS and also wakes on the
// LISTEN channel, so it has no queue of its own; these are the queues it fills.
export const PGBOSS_QUEUE_AUTOMATION_RUN = "automations.run";
export const PGBOSS_QUEUE_WEBHOOK_DELIVER = "webhooks.deliver";
export const PGBOSS_QUEUE_DEAL_ROTTING = "deals.rotting";
export const PGBOSS_QUEUE_EVENT_RETENTION = "events.retention";

// Part 8: the daily backup (02:00 UTC) and the recycle-bin purge (03:00 UTC). No payloads.
export const PGBOSS_QUEUE_BACKUP = "backups.run";
export const BACKUP_CRON = "0 2 * * *";
export const PGBOSS_QUEUE_RECYCLE_PURGE = "recycle.purge";
export const RECYCLE_PURGE_CRON = "0 3 * * *";

// Part 7: the bulk AI scoring job (payload { requesterId, dealIds }). One job per request.
export const PGBOSS_QUEUE_AI_BULK_SCORE = "ai.bulk-score";

// Daily schedules, UTC: rotting after the overnight sync work, retention after that.
export const DEAL_ROTTING_CRON = "0 5 * * *";
export const EVENT_RETENTION_CRON = "30 4 * * *";

// Part 14: campaign sending. One tick job per campaign, plus the scheduled start.
export const PGBOSS_QUEUE_CAMPAIGN_SEND = "campaign.send.tick";
export const PGBOSS_QUEUE_CAMPAIGN_START = "campaign.start";
