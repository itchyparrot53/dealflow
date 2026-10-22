import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { AppError } from "@/constants/errorIds";
import { PUSH_DELIVERY_QUEUE } from "@/constants/jobNames";
import type { Db } from "@/db/client";
import { notifications } from "@/db/schema";
import { ok, type Result } from "@/types/result";
import { deliverPush } from "./deliver";

// Queue payloads carry only the notification id; the row is the source of truth (title text,
// link and payload) and re-reading it means a notification edited before the job runs sends the
// edited text, matching the email worker's pattern.
export async function runPushDeliveryJob(
  db: Db,
  data: { notificationId: string },
  signal: AbortSignal,
): Promise<Result<{ sent: number; removed: number }, AppError>> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, data.notificationId))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) return ok({ sent: 0, removed: 0 });
  return deliverPush(
    db,
    {
      id: row.id,
      userId: row.userId,
      type: row.type,
      entityType: row.entityType,
      entityId: row.entityId,
      payload: row.payload,
    },
    signal,
  );
}

export async function registerPushDeliveryWorker(boss: PgBoss): Promise<void> {
  const { db } = await import("@/db/client");
  await boss.createQueue(PUSH_DELIVERY_QUEUE);
  await boss.work(
    PUSH_DELIVERY_QUEUE,
    async ([job]: Array<{ data: { notificationId: string } }>) => {
      if (job === undefined) return;
      const result = await runPushDeliveryJob(db, job.data, AbortSignal.timeout(30_000));
      if (!result.ok) {
        throw new AppError(result.error.id, "push delivery job failed", {
          notificationId: job.data.notificationId,
        });
      }
    },
  );
}
