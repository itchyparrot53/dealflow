"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { draftEmail, type EmailDraft, emailDraftInputSchema } from "../emailDraft";
import { checkAiRateLimit } from "../rateLimit";

// Drafts one email from a short instruction. The composer fills subject/body from the result; no
// mail is sent here.
export async function draftEmailAction(
  raw: unknown,
  csrfToken: string | null,
): Promise<ActionResult<EmailDraft>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };

  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!checkAiRateLimit(actor.id)) {
    return { ok: false, error: { id: ERROR_IDS.AI_RATE_LIMITED } };
  }

  const parsed = emailDraftInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };

  return toClientResult(await draftEmail(db, actor, parsed.data, SIG()));
}
