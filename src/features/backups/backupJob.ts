import type { PgBoss } from "pg-boss";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { BACKUP_CRON, PGBOSS_QUEUE_BACKUP } from "@/constants/jobNames";
import { db } from "@/db/client";
import { getBoss } from "@/jobs/boss";
import { err, ok, type Result } from "@/types/result";
import { runBackup } from "./backup";

export interface BackupJobData {
  trigger?: "schedule" | "manual";
  startedBy?: string | null;
}

// "Back up now" enqueues; the worker owns the read-write backup volume. The app mounts it
// read-only, so running the job in the request would always fail the writability probe.
export async function enqueueBackup(
  startedBy: string | null,
): Promise<Result<{ queued: true }, AppError>> {
  const boss = getBoss();
  if (boss === null) {
    return err(new AppError(ERROR_IDS.JOBS_BOSS_MISSING, "job queue is not running"));
  }
  await boss.send(PGBOSS_QUEUE_BACKUP, { trigger: "manual", startedBy } satisfies BackupJobData, {
    singletonKey: "backup-manual",
  });
  return ok({ queued: true });
}

// Schedules the daily backup at 02:00 UTC. Nothing is scheduled when BACKUP_ENABLED is false, so
// an install that turned backups off does not collect skipped queue rows every night.

export const BACKUP_JOB_TIMEOUT_MS = 30 * 60 * 1000;

export async function registerBackupJob(boss: PgBoss): Promise<void> {
  if (!env.BACKUP_ENABLED) return;
  await boss.createQueue(PGBOSS_QUEUE_BACKUP);
  await boss.work(PGBOSS_QUEUE_BACKUP, async ([job]) => {
    const data = (job?.data ?? {}) as BackupJobData;
    await runBackup(
      db,
      { trigger: data.trigger ?? "schedule", startedBy: data.startedBy ?? null },
      AbortSignal.timeout(BACKUP_JOB_TIMEOUT_MS),
    );
  });
  await boss.schedule(PGBOSS_QUEUE_BACKUP, BACKUP_CRON);
}
