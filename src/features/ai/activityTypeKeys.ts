import { isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { activityTypes } from "@/db/schema";

// Activity type keys a proposal may use: the active catalog, archived rows excluded. Shared by the
// deal summary prompts and the notes-to-activities prompt so their allow-lists always agree.
export async function listActiveActivityTypeKeys(db: Db, signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted();
  const rows = await db
    .select({ key: activityTypes.key })
    .from(activityTypes)
    .where(isNull(activityTypes.archivedAt))
    .orderBy(activityTypes.order);
  signal.throwIfAborted();
  return rows.map((row) => row.key);
}

// Test/demo databases seed the six system types; a bare database may have none. "task" is the
// safe fallback because every install seeds it.
export const FALLBACK_ACTIVITY_TYPE_KEY = "task";

export function resolveActivityKey(keys: readonly string[], candidate: string): string {
  return keys.includes(candidate) ? candidate : FALLBACK_ACTIVITY_TYPE_KEY;
}
