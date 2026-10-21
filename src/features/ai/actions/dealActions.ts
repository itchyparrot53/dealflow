"use server";

import { z } from "zod";
import { AI_ACTION_TIMEOUT_MS } from "@/constants/ai";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { type BulkScoreQueued, bulkScoreDeals } from "../bulkScore";
import { type DealAiInsightView, scoreDeal, summarizeDeal } from "../dealInsights";
import { type NoteProposals, proposeActivitiesFromNote } from "../notesToActivities";
import { checkAiRateLimit } from "../rateLimit";

const idSchema = z.string().uuid();

type ActionContext =
  | { ok: true; actor: NonNullable<Awaited<ReturnType<typeof createContext>>["actor"]> }
  | { ok: false; error: { id: string } };

// The shared prologue for the two deal AI actions: CSRF, a live actor, then the per-user rate limit.
async function context(csrfToken: string | null): Promise<ActionContext> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!checkAiRateLimit(actor.id)) return { ok: false, error: { id: ERROR_IDS.AI_RATE_LIMITED } };
  return { ok: true, actor };
}

export async function generateDealSummaryAction(
  dealId: string,
  csrfToken: string | null,
): Promise<ActionResult<DealAiInsightView>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const parsed = idSchema.safeParse(dealId);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };
  return toClientResult(
    await summarizeDeal(db, c.actor, parsed.data, AbortSignal.timeout(AI_ACTION_TIMEOUT_MS)),
  );
}

export async function scoreDealAction(
  dealId: string,
  csrfToken: string | null,
): Promise<ActionResult<DealAiInsightView>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const parsed = idSchema.safeParse(dealId);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };
  return toClientResult(
    await scoreDeal(db, c.actor, parsed.data, AbortSignal.timeout(AI_ACTION_TIMEOUT_MS)),
  );
}

export async function bulkScoreDealsAction(
  input: { dealIds: string[] },
  csrfToken: string | null,
): Promise<ActionResult<BulkScoreQueued>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  return toClientResult(
    await bulkScoreDeals(db, c.actor, input, AbortSignal.timeout(AI_ACTION_TIMEOUT_MS)),
  );
}

export async function proposeActivitiesFromNoteAction(
  noteId: string,
  csrfToken: string | null,
): Promise<ActionResult<NoteProposals>> {
  const c = await context(csrfToken);
  if (!c.ok) return c;
  const parsed = idSchema.safeParse(noteId);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };
  return toClientResult(
    await proposeActivitiesFromNote(
      db,
      c.actor,
      parsed.data,
      AbortSignal.timeout(AI_ACTION_TIMEOUT_MS),
    ),
  );
}
