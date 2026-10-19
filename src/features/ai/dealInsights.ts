import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { type DealSummaryData, dealAiInsights } from "@/db/schema";
import type { HydratedActor } from "@/server/hydrateActor";
import { ok, type Result } from "@/types/result";
import { listActiveActivityTypeKeys, resolveActivityKey } from "./activityTypeKeys";
import { chatJson } from "./chatJson";
import { buildDealContext } from "./dealContext";

const MS_PER_DAY = 86_400_000;
const SUMMARY_MAX_CHARS = 800;
const MAX_RISKS = 3;
const MAX_NEXT_STEPS = 3;
const MAX_REASONS = 4;

export interface DealAiInsightView {
  summary: DealSummaryData | null;
  summaryAt: string | null;
  score: number | null;
  scoreReasons: string[];
  scoredAt: string | null;
}

const EMPTY_VIEW: DealAiInsightView = {
  summary: null,
  summaryAt: null,
  score: null,
  scoreReasons: [],
  scoredAt: null,
};

export function dealSummaryPrompt(keys: readonly string[]): string {
  return `You are a sales analyst inside a CRM. Reply with JSON only, no other text, in exactly this shape: {"summary": string (max 80 words), "health": "good" | "at_risk" | "stalled", "risks": string[] (max 3, each max 20 words), "nextSteps": [{"subject": string (max 12 words), "typeKey": one of ${keys.join(", ")}, "dueInDays": integer 0-30}] (max 3)}. Use only the data given. If there is little data, say so in the summary.`;
}

export const DEAL_SCORE_PROMPT =
  'You score sales deals from 0 to 100 for likelihood to close. Use only the data given. Reply with JSON only: {"score": integer 0-100, "reasons": string[] (2-4 items, max 15 words each)}.';

function summarySchema(keys: readonly string[]) {
  return z
    .object({
      summary: z.string(),
      health: z.enum(["good", "at_risk", "stalled"]),
      risks: z.array(z.string()),
      nextSteps: z.array(
        z.object({ subject: z.string(), typeKey: z.string(), dueInDays: z.number() }),
      ),
    })
    .transform(
      (value): DealSummaryData => ({
        summary: value.summary.slice(0, SUMMARY_MAX_CHARS),
        health: value.health,
        risks: value.risks.slice(0, MAX_RISKS),
        nextSteps: value.nextSteps.slice(0, MAX_NEXT_STEPS).map((step) => ({
          subject: step.subject,
          typeKey: resolveActivityKey(keys, step.typeKey),
          dueInDays: Math.min(30, Math.max(0, Math.round(step.dueInDays))),
        })),
      }),
    );
}

const scoreSchema = z
  .object({ score: z.number(), reasons: z.array(z.string()) })
  .transform((value) => ({
    score: Math.min(100, Math.max(0, Math.round(value.score))),
    reasons: value.reasons.slice(0, MAX_REASONS),
  }));

export async function readDealAiInsight(
  db: Db,
  dealId: string,
  signal: AbortSignal,
): Promise<DealAiInsightView | null> {
  signal.throwIfAborted();
  const [row] = await db
    .select()
    .from(dealAiInsights)
    .where(eq(dealAiInsights.dealId, dealId))
    .limit(1);
  signal.throwIfAborted();
  if (row === undefined) return null;
  return {
    summary: row.summary ?? null,
    summaryAt: row.summaryAt?.toISOString() ?? null,
    score: row.score ?? null,
    scoreReasons: row.scoreReasons ?? [],
    scoredAt: row.scoredAt?.toISOString() ?? null,
  };
}

export async function summarizeDeal(
  db: Db,
  actor: HydratedActor,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<DealAiInsightView, AppError>> {
  const context = await buildDealContext(db, actor, dealId, signal);
  if (!context.ok) return context;

  const keys = await listActiveActivityTypeKeys(db, signal);
  const result = await chatJson(
    db,
    actor.id,
    "deal_summary",
    {
      system: dealSummaryPrompt(keys),
      user: JSON.stringify(context.value),
      schema: summarySchema(keys),
      maxTokens: 700,
    },
    signal,
  );
  if (!result.ok) return result;

  const summaryAt = new Date();
  await db
    .insert(dealAiInsights)
    .values({ dealId, summary: result.value, summaryAt })
    .onConflictDoUpdate({
      target: dealAiInsights.dealId,
      set: { summary: result.value, summaryAt },
    });
  return ok(
    (await readDealAiInsight(db, dealId, signal)) ?? { ...EMPTY_VIEW, summary: result.value },
  );
}

export async function scoreDeal(
  db: Db,
  actor: HydratedActor,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<DealAiInsightView, AppError>> {
  const context = await buildDealContext(db, actor, dealId, signal);
  if (!context.ok) return context;

  const latestDone = context.value.recentActivities[0]?.doneAt;
  const daysSinceLastActivity =
    latestDone === undefined
      ? null
      : Math.max(0, Math.floor((Date.now() - new Date(latestDone).getTime()) / MS_PER_DAY));
  const user = JSON.stringify({
    ...context.value,
    daysSinceLastActivity,
    openActivities: context.value.upcomingActivities.length,
  });

  const result = await chatJson(
    db,
    actor.id,
    "deal_score",
    { system: DEAL_SCORE_PROMPT, user, schema: scoreSchema, maxTokens: 400 },
    signal,
  );
  if (!result.ok) return result;

  const scoredAt = new Date();
  await db
    .insert(dealAiInsights)
    .values({ dealId, score: result.value.score, scoreReasons: result.value.reasons, scoredAt })
    .onConflictDoUpdate({
      target: dealAiInsights.dealId,
      set: { score: result.value.score, scoreReasons: result.value.reasons, scoredAt },
    });
  return ok(
    (await readDealAiInsight(db, dealId, signal)) ?? {
      ...EMPTY_VIEW,
      score: result.value.score,
      scoreReasons: result.value.reasons,
      scoredAt: scoredAt.toISOString(),
    },
  );
}
