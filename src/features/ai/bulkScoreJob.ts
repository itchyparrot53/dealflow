import type { PgBoss } from "pg-boss";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { BULK_SCORE_MAX } from "@/constants/insights";
import { PGBOSS_QUEUE_AI_BULK_SCORE } from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";
import { scoreDeal } from "@/features/ai/dealInsights";
import { checkAiRateLimit } from "@/features/ai/rateLimit";
import { createNotification } from "@/features/notifications/produce";
import { hydrateActor } from "@/server/hydrateActor";
import { err, ok, type Result } from "@/types/result";

// The bulk scoring job: one deal at a time, as the requester, stopping at the first AI cap or
// rate-limit refusal rather than burning through the remaining ids. It always reports back with
// one `ai_bulk_score` notification, including the "(AI limit reached)" suffix when it stopped
// early. A per-deal failure that is not a cap (deal deleted, provider error) is skipped and the
// rest continue, because one bad deal must not abandon the batch.

export const BULK_SCORE_JOB_TIMEOUT_MS = 10 * 60 * 1000;

const payloadSchema = z.object({
  requesterId: z.uuid(),
  dealIds: z.array(z.uuid()).min(1).max(BULK_SCORE_MAX),
});

export interface BulkScoreOutcome {
  scored: number;
  requested: number;
  stopped: boolean;
}

const LIMIT_IDS: ReadonlySet<string> = new Set([
  ERROR_IDS.AI_COMPANY_LIMIT,
  ERROR_IDS.AI_USER_LIMIT,
  ERROR_IDS.AI_RATE_LIMITED,
  ERROR_IDS.AI_DISABLED,
  ERROR_IDS.AI_UNAVAILABLE,
]);

export async function runBulkScoreJob(
  db: Db,
  payload: unknown,
  signal: AbortSignal,
): Promise<Result<BulkScoreOutcome, AppError>> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.INSIGHT_INPUT_INVALID, "invalid bulk score job payload", {
        issues: parsed.error.issues,
      }),
    );
  }
  const actor = await hydrateActor(db, parsed.data.requesterId, signal);
  if (actor === null) {
    return err(new AppError(ERROR_IDS.AUTH_SESSION_DEAD, "the requester is no longer active"));
  }

  let scored = 0;
  let stopped = false;
  for (const dealId of parsed.data.dealIds) {
    signal.throwIfAborted();
    if (!checkAiRateLimit(actor.id)) {
      stopped = true;
      break;
    }
    const result = await scoreDeal(db, actor, dealId, signal);
    if (result.ok) {
      scored += 1;
      continue;
    }
    if (LIMIT_IDS.has(result.error.id)) {
      stopped = true;
      break;
    }
    // Not a limit: skip this deal and score the next one.
  }

  const total = parsed.data.dealIds.length;
  const message = `Scored ${scored} of ${total} deals${stopped ? " (AI limit reached)" : ""}`;
  await createNotification(
    db,
    {
      recipientId: actor.id,
      type: "ai_bulk_score",
      entityType: null,
      entityId: null,
      actorId: actor.id,
      payload: { message },
    },
    signal,
  );
  return ok({ scored, requested: total, stopped });
}

export async function registerBulkScoreJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_AI_BULK_SCORE);
  await boss.work(PGBOSS_QUEUE_AI_BULK_SCORE, async ([job]) => {
    if (job === undefined) return;
    try {
      await runBulkScoreJob(defaultDb, job.data, AbortSignal.timeout(BULK_SCORE_JOB_TIMEOUT_MS));
    } catch (error) {
      console.error(`ai.bulk-score job failed`, error);
    }
  });
}
