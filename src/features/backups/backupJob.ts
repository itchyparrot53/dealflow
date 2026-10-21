import type { PgBoss } from "pg-boss";
import { env } from "@/config/env";
import { BACKUP_CRON, PGBOSS_QUEUE_BACKUP } from "@/constants/jobNames";
import { db } from "@/db/client";
import { runBackup } from "./backup";

// Schedules the daily backup at 02:00 UTC. Nothing is scheduled when BACKUP_ENABLED is false, so
// an install that turned backups off does not collect skipped queue rows every night.

export const BACKUP_JOB_TIMEOUT_MS = 30 * 60 * 1000;

export async function registerBackupJob(boss: PgBoss): Promise<void> {
  if (!env.BACKUP_ENABLED) return;
  await boss.createQueue(PGBOSS_QUEUE_BACKUP);
  await boss.work(PGBOSS_QUEUE_BACKUP, async () => {
    await runBackup(db, { trigger: "schedule" }, AbortSignal.timeout(BACKUP_JOB_TIMEOUT_MS));
  });
  await boss.schedule(PGBOSS_QUEUE_BACKUP, BACKUP_CRON);
}
