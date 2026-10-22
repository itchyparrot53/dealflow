import { and, desc, eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { type PushSubscription, pushSubscriptions } from "@/db/schema";
import type { AuthUser } from "@/features/permissions/types";
import { err, ok, type Result } from "@/types/result";
import { pushSubscribeInput as inputSchema, type PushSubscribeInput } from "./schemas";

function invalid(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(ERROR_IDS.PUSH_SUBSCRIPTION_INVALID, message, context);
}

export async function subscribePush(
  db: Db,
  actor: AuthUser,
  input: PushSubscribeInput,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new AppError(ERROR_IDS.PUSH_INPUT_INVALID, "invalid push subscription input"));
  }
  const { endpoint, keys, userAgent } = parsed.data;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return err(invalid("the endpoint is not a URL"));
  }
  if (url.protocol !== "https:") return err(invalid("the endpoint must be https"));
  if (keys.p256dh === "" || keys.auth === "")
    return err(invalid("the subscription keys are empty"));

  // One endpoint per browser profile: a re-subscribe (or a different user on a shared machine)
  // updates the row in place instead of leaving a duplicate that would receive every push twice.
  await db
    .insert(pushSubscriptions)
    .values({
      userId: actor.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: actor.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
        // A fresh subscription is healthy again; the next delivery re-earns last_success_at.
        failures: 0,
      },
    });
  signal.throwIfAborted();
  return ok(undefined);
}

export async function unsubscribePush(
  db: Db,
  actor: AuthUser,
  endpoint: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  // Scoped by user: knowing an endpoint is not enough to remove someone else's subscription.
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.endpoint, endpoint)));
  signal.throwIfAborted();
  return ok(undefined);
}

export async function listMySubscriptions(
  db: Db,
  userId: string,
  signal: AbortSignal,
): Promise<PushSubscription[]> {
  signal.throwIfAborted();
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.createdAt));
  signal.throwIfAborted();
  return rows;
}
