import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { EVENT_RETENTION_DAYS, RUN_RETENTION_DAYS } from "@/constants/automations";
import { EVENT_RETENTION_CRON, PGBOSS_QUEUE_EVENT_RETENTION } from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";

// Retention. Events are the short-lived queue (processed rows only); runs and finished deliveries
// are the audit trail and live three times as long. Unprocessed events are never deleted: a
// backlog is a bug, not garbage.

const JOB_TIMEOUT_MS = 60_000;

export interface RetentionResult {
  events: number;
  runs: number;
  deliveries: number;
}

export async function runRetention(db: Db, signal: AbortSignal): Promise<RetentionResult> {
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const events = await tx.execute(sql`
      DELETE FROM domain_events
      WHERE processed_at IS NOT NULL
        AND created_at < now() - ${EVENT_RETENTION_DAYS} * interval '1 day'
    `);
    const runs = await tx.execute(sql`
      DELETE FROM automation_runs
      WHERE finished_at IS NOT NULL
        AND started_at < now() - ${RUN_RETENTION_DAYS} * interval '1 day'
    `);
    const deliveries = await tx.execute(sql`
      DELETE FROM webhook_deliveries
      WHERE status IN ('succeeded', 'failed')
        AND created_at < now() - ${RUN_RETENTION_DAYS} * interval '1 day'
    `);
    return {
      events: events.rowCount ?? 0,
      runs: runs.rowCount ?? 0,
      deliveries: deliveries.rowCount ?? 0,
    };
  });
}

export async function registerRetentionJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_EVENT_RETENTION);
  await boss.work(PGBOSS_QUEUE_EVENT_RETENTION, async () => {
    await runRetention(defaultDb, AbortSignal.timeout(JOB_TIMEOUT_MS));
  });
  await boss.schedule(PGBOSS_QUEUE_EVENT_RETENTION, EVENT_RETENTION_CRON);
}
