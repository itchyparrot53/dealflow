import type { PgBoss as PgBossType } from "pg-boss";
import { PgBoss } from "pg-boss";
import { env } from "@/config/env";
import { registerReminderWorker } from "@/features/activities/reminders";
import { registerBulkScoreJob } from "@/features/ai/bulkScoreJob";
import { registerAutomationRunner } from "@/features/automations/runner";
import { registerOverdueDocumentsJob } from "@/features/documents/overdueJob";
import { registerEmailJobs } from "@/features/email/workerJobs";
import { registerEventJobs } from "@/features/events/dispatcherJob";
import { registerReaperJob } from "@/features/files/reaper";
import { registerImportWorkers } from "@/features/import/registerImportWorkers";
import { type IdleManager, startIdleManager } from "@/features/mail/idle/idleManager";
import { registerMailAppendWorker } from "@/features/mail/imap/appendSent";
import { registerMailBackfillWorker } from "@/features/mail/imap/backfill";
import { registerEmailNotificationWorker } from "@/features/notifications/email/job";
import { registerReleaseCheckJob } from "@/features/release/job";
import { registerWebhookDeliveryJob } from "@/features/webhooks/deliveryJob";
import { setBoss } from "@/jobs/boss";

// Register all job handlers and schedules. Called after boss.start() and
// setBoss() so producers see the live boss before handlers are registered.
// Order: email jobs first (sync + send handlers + initial enqueues), then
// the file reaper (hourly cron schedule), then the activity reminder worker.
export async function registerAllJobs(boss: PgBossType): Promise<void> {
  await registerEmailJobs(boss);
  await registerMailBackfillWorker(boss);
  await registerMailAppendWorker(boss);
  await registerReaperJob(boss);
  await registerImportWorkers(boss);
  await registerEmailNotificationWorker(boss);
  await registerReminderWorker(boss);
  // Daily overdue invoice sweep (06:00 UTC). Safe on every worker boot: the
  // schedule is idempotent and the UPDATE only touches sent invoices past due.
  await registerOverdueDocumentsJob(boss);
  // Update-check cron (OSS self-hosters). No-op when DISABLE_UPDATE_CHECK is set.
  await registerReleaseCheckJob(boss);
  // Event backbone: rotting and retention crons, the dispatcher poll, and the LISTEN wake-up.
  await registerEventJobs(boss);
  // Automation runs: the queue the dispatcher fills (2.1).
  await registerAutomationRunner(boss);
  // Webhook deliveries: the queue the dispatcher fills (3.1).
  await registerWebhookDeliveryJob(boss);
  // Part 7 bulk AI scoring.
  await registerBulkScoreJob(boss);
}

// Compose `worker` service. Boots pg-boss, publishes the singleton so producers
// can enqueue, then registers all job handlers and cron schedules.
export async function startWorker(): Promise<PgBoss> {
  const boss = new PgBoss(env.DATABASE_URL);
  await boss.start();
  // Publish the live boss before registering handlers so producers that run
  // during registration (e.g. initial sync enqueues) already see a live boss.
  setBoss(boss);
  await registerAllJobs(boss);
  const idle: IdleManager = startIdleManager(boss);
  // One shutdown path: stop the IDLE sessions, then pg-boss's own graceful stop.
  const shutdown = async (): Promise<void> => {
    await idle.stop();
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
  console.warn("worker (pg-boss) started");
  return boss;
}
