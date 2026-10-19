import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { aiSettings } from "@/db/schema";

// The limits live in a singleton row (id = true) so there is exactly one company-wide setting set.
// The migration seeds it; getAiSettings also inserts defensively so a restored database that lost
// the row still boots.

type AiSettings = typeof aiSettings.$inferSelect;

export const aiSettingsInputSchema = z.object({
  enabled: z.boolean(),
  companyMonthlyTokenLimit: z.number().int().min(0).max(1_000_000_000),
  userMonthlyTokenLimit: z.number().int().min(1).max(1_000_000_000).nullable(),
});

export type AiSettingsInput = z.infer<typeof aiSettingsInputSchema>;

export async function getAiSettings(db: Db, signal: AbortSignal): Promise<AiSettings> {
  signal.throwIfAborted();
  await db.insert(aiSettings).values({ id: true }).onConflictDoNothing();
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, true)).limit(1);
  signal.throwIfAborted();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INVARIANT, "ai_settings singleton is missing");
  }
  return row;
}

export async function updateAiSettings(
  db: Db,
  input: AiSettingsInput,
  signal: AbortSignal,
): Promise<AiSettings> {
  signal.throwIfAborted();
  await getAiSettings(db, signal);
  const [row] = await db.update(aiSettings).set(input).where(eq(aiSettings.id, true)).returning();
  signal.throwIfAborted();
  if (row === undefined) {
    throw new AppError(ERROR_IDS.DB_INVARIANT, "ai_settings update returned no row");
  }
  return row;
}
