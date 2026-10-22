import { and, eq } from "drizzle-orm";
import { DEFAULT_PUSH_BY_TYPE } from "@/constants/notificationDefaults";
import type { NotificationType } from "@/constants/notificationTypes";
import { NOTIFICATION_TYPES } from "@/constants/notificationTypes";
import type { Db } from "@/db/client";
import { notificationPushPrefs } from "@/db/schema";

export async function getPushPrefs(
  db: Db,
  userId: string,
  signal: AbortSignal,
): Promise<Record<NotificationType, boolean>> {
  signal.throwIfAborted();
  const rows = await db
    .select()
    .from(notificationPushPrefs)
    .where(eq(notificationPushPrefs.userId, userId));
  signal.throwIfAborted();

  const byType = new Map(rows.map((row) => [row.type, row.enabled]));
  const out = {} as Record<NotificationType, boolean>;
  // A missing row means "use the shipped default", so changing a default later reaches every
  // user who never touched that switch.
  for (const type of NOTIFICATION_TYPES) out[type] = byType.get(type) ?? DEFAULT_PUSH_BY_TYPE[type];
  return out;
}

export async function setPushPref(
  db: Db,
  userId: string,
  type: NotificationType,
  enabled: boolean,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db
    .insert(notificationPushPrefs)
    .values({ userId, type, enabled })
    .onConflictDoUpdate({
      target: [notificationPushPrefs.userId, notificationPushPrefs.type],
      set: { enabled },
    });
  signal.throwIfAborted();
}

export async function pushPrefEnabled(
  db: Db,
  userId: string,
  type: NotificationType,
  signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(notificationPushPrefs)
    .where(and(eq(notificationPushPrefs.userId, userId), eq(notificationPushPrefs.type, type)));
  signal.throwIfAborted();
  return row?.enabled ?? DEFAULT_PUSH_BY_TYPE[type];
}
