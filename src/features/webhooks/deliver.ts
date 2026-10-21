import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import {
  WEBHOOK_DISABLE_AFTER,
  WEBHOOK_MAX_RESPONSE_BYTES,
  WEBHOOK_RETRY_SECONDS,
  WEBHOOK_TIMEOUT_MS,
} from "@/constants/automations";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { PGBOSS_QUEUE_WEBHOOK_DELIVER } from "@/constants/jobNames";
import { env } from "@/config/env";
import { type Db, db as defaultDb } from "@/db/client";
import { users, webhookDeliveries, webhookSubscriptions } from "@/db/schema";
import { decryptToken } from "@/features/email/crypto";
import { getSystemMailer } from "@/features/mailer/systemMailer";
import { getBoss } from "@/jobs/boss";
import { checkWebhookUrl, isBlockedAddress } from "./ipRanges";
import { signatureHeader } from "./signature";

// Outgoing webhook delivery. Every request goes through `http(s).request` (never `fetch`) with a
// custom `lookup` that resolves and vets EVERY address at connect time, so there is no
// check-then-connect gap. Redirects are never followed, the body read is capped, and a failure is
// recorded on the delivery row rather than thrown.

export interface DeliverDeps {
  allowPrivate?: boolean;
  timeoutMs?: number;
  now?: () => number;
}

export interface DeliveryOutcome {
  status: "succeeded" | "retrying" | "failed";
  statusCode: number | null;
  errorId: string | null;
  durationMs: number;
}

const USER_AGENT = "Dealflow-Webhooks/1";

// Node's fetch cannot pin the resolved address; this lookup is the reason delivery uses http.request.
function pinnedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, _options, callback): void => {
    dnsLookup(hostname, { all: true })
      .then((addresses) => {
        const first = addresses[0];
        if (first === undefined) {
          callback(new AppError(ERROR_IDS.WEBHOOK_URL_REFUSED, "host has no address", { hostname }), "");
          return;
        }
        if (!allowPrivate) {
          const blocked = addresses.find((entry) => isBlockedAddress(entry.address));
          if (blocked !== undefined) {
            callback(
              new AppError(ERROR_IDS.WEBHOOK_URL_REFUSED, "host resolves to a blocked address", {
                address: blocked.address,
              }),
              "",
            );
            return;
          }
        }
        callback(null, first.address, first.family === 6 ? 6 : 4);
      })
      .catch((error: unknown) => {
        callback(error instanceof Error ? (error as NodeJS.ErrnoException) : new Error("dns failed"), "");
      });
  };
}

interface PostResult {
  statusCode: number;
}

function postOnce(
  url: URL,
  body: string,
  headers: Record<string, string>,
  allowPrivate: boolean,
  timeoutMs: number,
): Promise<PostResult> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      action();
    };

    const request = lib.request(
      url,
      {
        method: "POST",
        headers,
        lookup: pinnedLookup(allowPrivate),
        signal: AbortSignal.timeout(timeoutMs),
      },
      (response) => {
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > WEBHOOK_MAX_RESPONSE_BYTES) {
            // Read only a bounded amount; the receiver's body is never stored.
            response.destroy();
            finish(() => resolve({ statusCode: response.statusCode ?? 0 }));
          }
        });
        response.on("end", () => {
          finish(() => resolve({ statusCode: response.statusCode ?? 0 }));
        });
        response.on("error", (error) => {
          finish(() => reject(error));
        });
      },
    );

    request.on("error", (error) => {
      finish(() => reject(error));
    });
    request.write(body);
    request.end();
  });
}

function errorIdOf(error: unknown): string {
  if (error instanceof AppError) return error.id;
  const name = error instanceof Error ? error.name : "";
  return name === "AbortError" || name === "TimeoutError"
    ? ERROR_IDS.WEBHOOK_DELIVERY_FAILED
    : ERROR_IDS.WEBHOOK_DELIVERY_FAILED;
}

function errorMessageOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") return "request timed out";
  return error instanceof Error ? error.message : String(error);
}

function truncate(text: string): string {
  return text.length <= 500 ? text : `${text.slice(0, 497)}...`;
}

async function disableSubscription(
  db: Db,
  subscriptionId: string,
  reason: string,
  createdBy: string | null,
  signal: AbortSignal,
): Promise<void> {
  await db
    .update(webhookSubscriptions)
    .set({ enabled: false, disabledReason: reason, updatedAt: new Date() })
    .where(eq(webhookSubscriptions.id, subscriptionId));

  if (createdBy === null) return;
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, createdBy));
  if (user === undefined) return;
  try {
    await getSystemMailer().send(
      {
        to: user.email,
        subject: "A Dealflow webhook was disabled",
        text: `Hello ${user.name},\n\nThe webhook subscription was disabled: ${reason}.\n\nRe-enable it in Settings > Webhooks after fixing the receiver.`,
        html: `<p>Hello ${user.name},</p><p>The webhook subscription was disabled: ${reason}.</p><p>Re-enable it in Settings &gt; Webhooks after fixing the receiver.</p>`,
      },
      signal,
    );
  } catch (error) {
    // The disable is the important part; a mail failure must not undo it.
    console.error("webhook disable email failed", error);
  }
}

async function enqueueRetry(db: Db, deliveryId: string): Promise<void> {
  const boss: PgBoss | null = getBoss();
  if (boss === null) return;
  const [row] = await db
    .select({ nextAttemptAt: webhookDeliveries.nextAttemptAt })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId));
  if (row?.nextAttemptAt == null) return;
  const seconds = Math.max(1, Math.ceil((row.nextAttemptAt.getTime() - Date.now()) / 1000));
  await boss.send(PGBOSS_QUEUE_WEBHOOK_DELIVER, { deliveryId }, { startAfter: seconds });
}

export async function deliverWebhook(
  db: Db,
  deliveryId: string,
  signal: AbortSignal,
  deps: DeliverDeps = {},
): Promise<DeliveryOutcome> {
  signal.throwIfAborted();
  const allowPrivate = deps.allowPrivate ?? env.WEBHOOK_ALLOW_PRIVATE;
  const timeoutMs = deps.timeoutMs ?? WEBHOOK_TIMEOUT_MS;
  const now = deps.now ?? (() => Date.now());

  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId));
  const [subscription] =
    delivery === undefined
      ? []
      : await db
          .select()
          .from(webhookSubscriptions)
          .where(eq(webhookSubscriptions.id, delivery.subscriptionId));
  if (delivery === undefined || subscription === undefined) {
    return { status: "failed", statusCode: null, errorId: ERROR_IDS.WEBHOOK_NOT_FOUND, durationMs: 0 };
  }

  // A disabled subscription never receives anything again; record it and stop.
  if (!subscription.enabled) {
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastError: "subscription disabled", updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, delivery.id));
    return {
      status: "failed",
      statusCode: null,
      errorId: ERROR_IDS.WEBHOOK_DISABLED,
      durationMs: 0,
    };
  }

  const sealed = decryptToken(subscription.secretEnc);
  if (!sealed.ok) {
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastError: sealed.error.id, updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, delivery.id));
    return { status: "failed", statusCode: null, errorId: sealed.error.id, durationMs: 0 };
  }

  const secret = sealed.value;
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(now() / 1000);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    "x-dealflow-event": delivery.eventType,
    "x-dealflow-delivery": delivery.id,
    "x-dealflow-signature": signatureHeader(secret, timestamp, body),
  };

  const started = now();
  let statusCode: number | null = null;
  let failure: { errorId: string; message: string } | null = null;

  const url = checkWebhookUrl(subscription.url, allowPrivate);
  if (!url.ok) {
    failure = { errorId: url.error.id, message: "URL refused" };
  } else {
    try {
      const response = await postOnce(url.value, body, headers, allowPrivate, timeoutMs);
      statusCode = response.statusCode;
      if (statusCode < 200 || statusCode >= 300) {
        failure = {
          errorId: ERROR_IDS.WEBHOOK_DELIVERY_FAILED,
          message: statusCode >= 300 && statusCode < 400 ? "redirect not followed" : "non-2xx",
        };
      }
    } catch (error) {
      failure = { errorId: errorIdOf(error), message: errorMessageOf(error) };
    }
  }

  const durationMs = Math.max(0, now() - started);
  signal.throwIfAborted();

  if (failure === null) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "succeeded",
        lastStatusCode: statusCode,
        lastError: null,
        nextAttemptAt: null,
        durationMs,
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));
    await db
      .update(webhookSubscriptions)
      .set({ consecutiveFailures: 0, lastDeliveryAt: new Date(), updatedAt: new Date() })
      .where(eq(webhookSubscriptions.id, subscription.id));
    return { status: "succeeded", statusCode, errorId: null, durationMs };
  }

  // 410 Gone means the endpoint is deliberately retired: disable now, no retries.
  if (statusCode === 410) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        attempts: delivery.attempts + 1,
        lastStatusCode: 410,
        lastError: truncate("receiver returned 410 Gone"),
        durationMs,
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));
    await disableSubscription(
      db,
      subscription.id,
      "Receiver returned 410 Gone",
      subscription.createdBy,
      signal,
    );
    return {
      status: "failed",
      statusCode,
      errorId: ERROR_IDS.WEBHOOK_DELIVERY_FAILED,
      durationMs,
    };
  }

  const attempts = delivery.attempts + 1;
  const consecutiveFailures = subscription.consecutiveFailures + 1;
  const retrySeconds = attempts <= WEBHOOK_RETRY_SECONDS.length
    ? WEBHOOK_RETRY_SECONDS[attempts - 1]
    : undefined;
  const finalStatus = retrySeconds === undefined ? "failed" : "retrying";
  const nextAttemptAt =
    retrySeconds === undefined ? null : new Date(now() + retrySeconds * 1000);

  await db
    .update(webhookDeliveries)
    .set({
      status: finalStatus,
      attempts,
      nextAttemptAt,
      lastStatusCode: statusCode,
      lastError: truncate(failure.message),
      durationMs,
      updatedAt: new Date(),
    })
    .where(eq(webhookDeliveries.id, delivery.id));
  await db
    .update(webhookSubscriptions)
    .set({ consecutiveFailures, updatedAt: new Date() })
    .where(eq(webhookSubscriptions.id, subscription.id));

  if (consecutiveFailures >= WEBHOOK_DISABLE_AFTER) {
    await disableSubscription(
      db,
      subscription.id,
      `Disabled after ${WEBHOOK_DISABLE_AFTER} failed deliveries`,
      subscription.createdBy,
      signal,
    );
  } else if (finalStatus === "retrying") {
    await enqueueRetry(db, delivery.id);
  }

  return {
    status: finalStatus,
    statusCode,
    errorId: failure.errorId,
    durationMs,
  };
}

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
