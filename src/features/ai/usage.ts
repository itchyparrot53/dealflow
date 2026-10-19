import { and, eq, gte, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { aiUsage, users } from "@/db/schema";
import { err, ok, type Result } from "@/types/result";
import { getAiSettings } from "./aiSettings";
import { getAiProvider } from "./provider";
import type { AiChatResult, AiFeature, AiProvider } from "./types";

const TOKENS = sql<number>`coalesce(sum(${aiUsage.promptTokens} + ${aiUsage.completionTokens}), 0)::int`;

// First day of the current month at 00:00 UTC: the window the company and per-user caps use.
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function tokensSince(db: Db, since: Date, userId?: string): Promise<number> {
  const where =
    userId === undefined
      ? gte(aiUsage.createdAt, since)
      : and(gte(aiUsage.createdAt, since), eq(aiUsage.userId, userId));
  const [row] = await db.select({ tokens: TOKENS }).from(aiUsage).where(where);
  return row?.tokens ?? 0;
}

export interface AiUsageOverview {
  monthStart: Date;
  companyUsed: number;
  byFeature: { feature: string; tokens: number }[];
  byUser: { userId: string; name: string; tokens: number }[];
}

export async function getUsage(db: Db, signal: AbortSignal): Promise<AiUsageOverview> {
  const monthStart = monthStartUtc();
  signal.throwIfAborted();
  const companyUsed = await tokensSince(db, monthStart);
  const byFeature = await db
    .select({ feature: aiUsage.feature, tokens: TOKENS })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, monthStart))
    .groupBy(aiUsage.feature)
    .orderBy(aiUsage.feature);
  const byUser = await db
    .select({ userId: aiUsage.userId, name: users.name, tokens: TOKENS })
    .from(aiUsage)
    .innerJoin(users, eq(users.id, aiUsage.userId))
    .where(gte(aiUsage.createdAt, monthStart))
    .groupBy(aiUsage.userId, users.name)
    .orderBy(users.name);
  signal.throwIfAborted();
  return {
    monthStart,
    companyUsed,
    byFeature,
    byUser: byUser.flatMap((row) =>
      row.userId === null ? [] : [{ userId: row.userId, name: row.name, tokens: row.tokens }],
    ),
  };
}

// The gate every AI call passes through, in the order the plan fixes: provider, settings, company
// cap, then the optional per-user cap.
export async function assertAiAllowed(
  db: Db,
  actorId: string,
  signal: AbortSignal,
): Promise<Result<AiProvider, AppError>> {
  const provider = getAiProvider();
  if (provider === null) {
    return err(new AppError(ERROR_IDS.AI_UNAVAILABLE, "no AI provider is configured"));
  }
  const settings = await getAiSettings(db, signal);
  if (!settings.enabled) {
    return err(new AppError(ERROR_IDS.AI_DISABLED, "AI is disabled for this company"));
  }
  const monthStart = monthStartUtc();
  const companyUsed = await tokensSince(db, monthStart);
  if (companyUsed >= settings.companyMonthlyTokenLimit) {
    return err(new AppError(ERROR_IDS.AI_COMPANY_LIMIT, "company monthly token limit reached"));
  }
  if (settings.userMonthlyTokenLimit !== null) {
    const userUsed = await tokensSince(db, monthStart, actorId);
    if (userUsed >= settings.userMonthlyTokenLimit) {
      return err(new AppError(ERROR_IDS.AI_USER_LIMIT, "user monthly token limit reached"));
    }
  }
  signal.throwIfAborted();
  return ok(provider);
}

export async function recordAiUsage(
  db: Db,
  entry: { userId: string; feature: AiFeature; result: AiChatResult },
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db.insert(aiUsage).values({
    userId: entry.userId,
    feature: entry.feature,
    model: entry.result.model,
    promptTokens: entry.result.usage.promptTokens,
    completionTokens: entry.result.usage.completionTokens,
  });
  signal.throwIfAborted();
}
