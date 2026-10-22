import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { AppError } from "@/constants/errorIds";
import { PUSH_DELIVERY_QUEUE } from "@/constants/jobNames";
import type { NotificationType } from "@/constants/notificationTypes";
import { PUSH_MAX_FAILURES, PUSH_TTL_SECONDS } from "@/constants/pwa";
import type { Db } from "@/db/client";
import { type PushSubscription, pushSubscriptions } from "@/db/schema";
import { notificationLabel } from "@/features/notifications/labels";
import { notificationHref } from "@/features/notifications/ui/deepLink";
import { requireBoss } from "@/jobs/requireBoss";
import type { NotificationFeedItem } from "@/types/notification";
import { ok, type Result } from "@/types/result";
import { buildPushPayload } from "./payload";
import { pushPrefEnabled } from "./prefs";
import { listMySubscriptions } from "./subscriptions";
import { configureWebPush, fakePushEnabled, pushConfigured, pushFakeDir } from "./vapid";

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushSendResult = { ok: true } | { ok: false; statusCode: number | null };
// Injectable so the integration tests never touch the network (a stub can return 410 or 500).
export type PushSender = (target: PushTarget, payload: string) => Promise<PushSendResult>;

export type DeliverPushInput = {
  id: string;
  userId: string;
  type: NotificationType;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
};

export type DeliverPushOptions = {
  sender?: PushSender;
  captureDir?: string;
  now?: () => Date;
  // Tests inject the mode and the sender so no VAPID keys and no network are needed. Production
  // callers leave both unset and get PUSH_FAKE / web-push from the env.
  mode?: "fake" | "send";
};

const defaultSender: PushSender = async (target, payload) => {
  const webpush = (await import("web-push")).default;
  try {
    await webpush.sendNotification({ endpoint: target.endpoint, keys: target.keys }, payload, {
      TTL: PUSH_TTL_SECONDS,
      urgency: "normal",
      timeout: 10_000,
    });
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return { ok: false, statusCode: typeof statusCode === "number" ? statusCode : null };
  }
};

function hrefFor(input: DeliverPushInput): string {
  const item: NotificationFeedItem = {
    id: input.id,
    userId: input.userId,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: null,
    payload: input.payload,
    readAt: null,
    createdAt: "",
    band: "today",
  };
  return notificationHref(item);
}

async function writeCapture(
  dir: string,
  notificationId: string,
  endpoint: string,
  payload: string,
) {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${String(Date.now())}-${notificationId}.json`);
  await writeFile(file, JSON.stringify({ endpoint, payload }, null, 2), "utf8");
}

async function markSuccess(db: Db, subscriptionId: string, now: Date): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ failures: 0, lastSuccessAt: now })
    .where(eq(pushSubscriptions.id, subscriptionId));
}

async function recordFailure(db: Db, subscription: PushSubscription): Promise<boolean> {
  const failures = subscription.failures + 1;
  if (failures >= PUSH_MAX_FAILURES) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
    return true;
  }
  await db
    .update(pushSubscriptions)
    .set({ failures })
    .where(eq(pushSubscriptions.id, subscription.id));
  return false;
}

type SubscriberOutcome = "sent" | "removed" | "none";

async function deliverToSubscription(
  db: Db,
  subscription: PushSubscription,
  payload: string,
  notificationId: string,
  options: DeliverPushOptions,
  now: Date,
): Promise<SubscriberOutcome> {
  try {
    if (options.mode === "fake" || (options.mode === undefined && fakePushEnabled())) {
      await writeCapture(
        options.captureDir ?? pushFakeDir(),
        notificationId,
        subscription.endpoint,
        payload,
      );
      await markSuccess(db, subscription.id, now);
      return "sent";
    }
    const sender = options.sender ?? defaultSender;
    const outcome = await sender(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
    );
    if (outcome.ok) {
      await markSuccess(db, subscription.id, now);
      return "sent";
    }
    if (outcome.statusCode === 404 || outcome.statusCode === 410) {
      // The subscription is gone for good; retrying can never succeed.
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      return "removed";
    }
    return (await recordFailure(db, subscription)) ? "removed" : "none";
  } catch (error) {
    console.warn("push delivery failed", { subscriptionId: subscription.id, error });
    return "none";
  }
}

// Best-effort by design: every operational failure is logged and swallowed, because a dead push
// service must never fail the notification that triggered it. Returns counts for the job log.
export async function deliverPush(
  db: Db,
  input: DeliverPushInput,
  signal: AbortSignal,
  options: DeliverPushOptions = {},
): Promise<Result<{ sent: number; removed: number }, AppError>> {
  const injected = options.sender !== undefined || options.mode !== undefined;
  if (!pushConfigured() && !injected) return ok({ sent: 0, removed: 0 });
  signal.throwIfAborted();

  // Re-checked at delivery time, not only at enqueue time, so turning a type off takes effect
  // for notifications already in the queue.
  if (!(await pushPrefEnabled(db, input.userId, input.type, signal))) {
    return ok({ sent: 0, removed: 0 });
  }
  const subscriptions = await listMySubscriptions(db, input.userId, signal);
  if (subscriptions.length === 0) return ok({ sent: 0, removed: 0 });

  const payload = buildPushPayload({
    // A notification has no separate subject line: the label is the whole in-app text, so the
    // push title carries it and the body stays empty rather than inventing new copy.
    title: notificationLabel(input.type, input.payload),
    body: "",
    href: hrefFor(input),
    id: input.id,
  });
  const now = options.now?.() ?? new Date();
  const fake = options.mode === "fake" || (options.mode === undefined && fakePushEnabled());
  if (!fake && options.sender === undefined && !configureWebPush()) {
    return ok({ sent: 0, removed: 0 });
  }

  let sent = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    signal.throwIfAborted();
    const outcome = await deliverToSubscription(db, subscription, payload, input.id, options, now);
    if (outcome === "sent") sent += 1;
    else if (outcome === "removed") removed += 1;
  }
  signal.throwIfAborted();
  return ok({ sent, removed });
}

// After the notification row commits, prefer the worker queue; without a queue (tests, scripts,
// a slim deploy) deliver inline. Logged so the operator can tell which path ran.
export async function enqueueOrDeliverPush(
  db: Db,
  input: DeliverPushInput,
  signal: AbortSignal,
): Promise<void> {
  const boss = requireBoss();
  if (boss !== null) {
    try {
      await boss.send(
        PUSH_DELIVERY_QUEUE,
        { notificationId: input.id },
        { singletonKey: `push:${input.id}` },
      );
      return;
    } catch (error) {
      console.warn("push: could not enqueue, delivering inline", { error });
    }
  }
  const result = await deliverPush(db, input, signal);
  if (!result.ok) console.warn("push: inline delivery failed", { error: result.error.id });
}
