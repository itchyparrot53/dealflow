import type { PgBoss } from "pg-boss";
import { WEBHOOK_TIMEOUT_MS } from "@/constants/automations";
import { PGBOSS_QUEUE_WEBHOOK_DELIVER } from "@/constants/jobNames";
import { db as defaultDb } from "@/db/client";
import { deliverWebhook } from "./deliver";

// The worker handler for queued deliveries. Enqueued by the dispatcher, a retry and a redelivery.
export async function registerWebhookDeliveryJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_WEBHOOK_DELIVER);
  await boss.work(PGBOSS_QUEUE_WEBHOOK_DELIVER, async ([job]) => {
    if (job === undefined) return;
    const data = (job.data ?? {}) as Record<string, unknown>;
    const deliveryId = typeof data.deliveryId === "string" ? data.deliveryId : null;
    if (deliveryId === null) return;
    try {
      await deliverWebhook(defaultDb, deliveryId, AbortSignal.timeout(WEBHOOK_TIMEOUT_MS + 5_000));
    } catch (error) {
      console.error(`webhook delivery ${deliveryId} threw`, error);
    }
  });
}
