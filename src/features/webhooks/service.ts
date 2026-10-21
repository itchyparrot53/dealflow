import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { PGBOSS_QUEUE_WEBHOOK_DELIVER } from "@/constants/jobNames";
import type { Db } from "@/db/client";
import {
  type WebhookDeliveryRow,
  type WebhookSubscriptionRow,
  webhookDeliveries,
  webhookSubscriptions,
} from "@/db/schema";
import { encryptToken } from "@/features/email/crypto";
import { DOMAIN_EVENT_TYPES } from "@/features/events/types";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { getBoss } from "@/jobs/boss";
import { err, ok, type Result } from "@/types/result";
import { deliverWebhook } from "./deliver";
import { checkWebhookUrl } from "./ipRanges";
import { newWebhookSecret } from "./signature";

// Webhook subscription CRUD. The plaintext secret exists only in the return value of create and
// rotate; every read selects the safe columns, so no API surface can return the sealed value.

export type SubscriptionView = Omit<WebhookSubscriptionRow, "secretEnc">;

export interface CreatedSubscription {
  subscription: SubscriptionView;
  secret: string;
}

const nameSchema = z.string().trim().min(1).max(120);

export const subscriptionInputSchema = z.object({
  name: nameSchema,
  url: z.string().trim().min(1).max(2000),
  events: z.array(z.enum(DOMAIN_EVENT_TYPES)).min(1),
});

export const subscriptionPatchSchema = z.object({
  name: nameSchema.optional(),
  url: z.string().trim().min(1).max(2000).optional(),
  events: z.array(z.enum(DOMAIN_EVENT_TYPES)).min(1).optional(),
});

const SAFE_COLUMNS = {
  id: webhookSubscriptions.id,
  name: webhookSubscriptions.name,
  url: webhookSubscriptions.url,
  events: webhookSubscriptions.events,
  enabled: webhookSubscriptions.enabled,
  consecutiveFailures: webhookSubscriptions.consecutiveFailures,
  disabledReason: webhookSubscriptions.disabledReason,
  createdBy: webhookSubscriptions.createdBy,
  lastDeliveryAt: webhookSubscriptions.lastDeliveryAt,
  createdAt: webhookSubscriptions.createdAt,
  updatedAt: webhookSubscriptions.updatedAt,
};

export function canManageWebhooks(actor: PermSetUser): boolean {
  return can(actor, "automations.manage");
}

function denied(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "automations.manage required", { userId: actor.id });
}

function invalid(issues: unknown): AppError {
  return new AppError(ERROR_IDS.WEBHOOK_INPUT_INVALID, "webhook input invalid", { issues });
}

function notFound(id: string): AppError {
  return new AppError(ERROR_IDS.WEBHOOK_NOT_FOUND, "Subscription not found", {
    subscriptionId: id,
  });
}

function validateUrl(raw: string): Result<string, AppError> {
  const parsed = checkWebhookUrl(raw, env.WEBHOOK_ALLOW_PRIVATE);
  return parsed.ok ? ok(parsed.value.toString()) : err(parsed.error);
}

export async function listSubscriptions(db: Db, signal: AbortSignal): Promise<SubscriptionView[]> {
  signal.throwIfAborted();
  return db
    .select(SAFE_COLUMNS)
    .from(webhookSubscriptions)
    .orderBy(desc(webhookSubscriptions.createdAt));
}

export async function getSubscription(
  db: Db,
  id: string,
  signal: AbortSignal,
): Promise<SubscriptionView | null> {
  signal.throwIfAborted();
  const [row] = await db
    .select(SAFE_COLUMNS)
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, id));
  return row ?? null;
}

export async function createSubscription(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<CreatedSubscription, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  const parsed = subscriptionInputSchema.safeParse(raw);
  if (!parsed.success) return err(invalid(parsed.error.issues));
  const url = validateUrl(parsed.data.url);
  if (!url.ok) return err(url.error);
  signal.throwIfAborted();

  const secret = newWebhookSecret();
  const [row] = await db
    .insert(webhookSubscriptions)
    .values({
      name: parsed.data.name,
      url: url.value,
      events: parsed.data.events,
      secretEnc: encryptToken(secret),
      createdBy: actor.id,
    })
    .returning(SAFE_COLUMNS);
  if (row === undefined) return err(notFound("insert"));
  // The only moment the plaintext secret exists.
  return ok({ subscription: row, secret });
}

export async function updateSubscription(
  db: Db,
  actor: PermSetUser,
  id: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<SubscriptionView, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  const parsed = subscriptionPatchSchema.safeParse(raw);
  if (!parsed.success) return err(invalid(parsed.error.issues));
  let url: string | undefined;
  if (parsed.data.url !== undefined) {
    const validated = validateUrl(parsed.data.url);
    if (!validated.ok) return err(validated.error);
    url = validated.value;
  }
  signal.throwIfAborted();

  const [row] = await db
    .update(webhookSubscriptions)
    .set({
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(url === undefined ? {} : { url }),
      ...(parsed.data.events === undefined ? {} : { events: parsed.data.events }),
      updatedAt: new Date(),
    })
    .where(eq(webhookSubscriptions.id, id))
    .returning(SAFE_COLUMNS);
  if (row === undefined) return err(notFound(id));
  return ok(row);
}

export async function rotateSecret(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<string, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  const secret = newWebhookSecret();
  signal.throwIfAborted();
  const [row] = await db
    .update(webhookSubscriptions)
    .set({ secretEnc: encryptToken(secret), updatedAt: new Date() })
    .where(eq(webhookSubscriptions.id, id))
    .returning({ id: webhookSubscriptions.id });
  if (row === undefined) return err(notFound(id));
  return ok(secret);
}

export async function setEnabled(
  db: Db,
  actor: PermSetUser,
  id: string,
  enabled: boolean,
  signal: AbortSignal,
): Promise<Result<SubscriptionView, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  signal.throwIfAborted();
  const [row] = await db
    .update(webhookSubscriptions)
    .set({
      enabled,
      // Re-enabling is a fresh start: a subscription stuck at ten failures would disable itself
      // again on the very next failure otherwise.
      ...(enabled ? { consecutiveFailures: 0, disabledReason: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(webhookSubscriptions.id, id))
    .returning(SAFE_COLUMNS);
  if (row === undefined) return err(notFound(id));
  return ok(row);
}

export async function deleteSubscription(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  signal.throwIfAborted();
  const [row] = await db
    .delete(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, id))
    .returning({ id: webhookSubscriptions.id });
  if (row === undefined) return err(notFound(id));
  return ok(undefined);
}

export async function listDeliveries(
  db: Db,
  actor: PermSetUser,
  subscriptionId: string,
  signal: AbortSignal,
): Promise<Result<WebhookDeliveryRow[], AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  signal.throwIfAborted();
  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.subscriptionId, subscriptionId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(100);
  return ok(rows);
}

export interface Redelivery {
  deliveryId: string;
}

export async function redeliver(
  db: Db,
  actor: PermSetUser,
  deliveryId: string,
  signal: AbortSignal,
): Promise<Result<Redelivery, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  const [source] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId));
  if (source === undefined) {
    return err(new AppError(ERROR_IDS.WEBHOOK_NOT_FOUND, "Delivery not found", { deliveryId }));
  }
  signal.throwIfAborted();
  const [row] = await db
    .insert(webhookDeliveries)
    .values({
      subscriptionId: source.subscriptionId,
      eventId: source.eventId,
      eventType: source.eventType,
      payload: source.payload,
      status: "pending",
    })
    .returning({ id: webhookDeliveries.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.WEBHOOK_DELIVERY_FAILED, "Redelivery insert failed", {}));
  }
  // A redelivery is a new queued delivery, not just a row: without the enqueue it would sit
  // pending forever in the log.
  const boss = getBoss();
  if (boss !== null) {
    await boss.send(PGBOSS_QUEUE_WEBHOOK_DELIVER, { deliveryId: row.id });
  }
  return ok({ deliveryId: row.id });
}

export interface TestDeliveryResult {
  status: "succeeded" | "retrying" | "failed";
  statusCode: number | null;
  durationMs: number;
}

// A test send is a real delivery of a synthetic `ping` event, recorded in the log like any other.
export async function sendTest(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<TestDeliveryResult, AppError>> {
  if (!canManageWebhooks(actor)) return err(denied(actor));
  const [subscription] = await db
    .select({ id: webhookSubscriptions.id })
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, id));
  if (subscription === undefined) return err(notFound(id));

  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      subscriptionId: id,
      eventType: "ping",
      payload: { id: "evt_test", type: "ping", data: {} },
      status: "pending",
    })
    .returning({ id: webhookDeliveries.id });
  if (delivery === undefined) {
    return err(new AppError(ERROR_IDS.WEBHOOK_DELIVERY_FAILED, "test delivery insert failed", {}));
  }

  const outcome = await deliverWebhook(db, delivery.id, signal);
  return ok({
    status: outcome.status,
    statusCode: outcome.statusCode,
    durationMs: outcome.durationMs,
  });
}
