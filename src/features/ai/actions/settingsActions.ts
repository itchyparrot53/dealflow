"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import type { ActionResult } from "@/types/actionResult";
import { aiSettingsInputSchema, updateAiSettings } from "../aiSettings";

// Admin-only settings write. Everything is a value, so the form can show the specific reason.
export async function updateAiSettingsAction(
  raw: unknown,
  csrfToken: string | null,
): Promise<ActionResult<{ ok: true }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };

  const { actor } = await createContext();
  if (actor === null || actor.type !== "admin") {
    return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  }

  const parsed = aiSettingsInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AI_INPUT_INVALID } };

  await updateAiSettings(db, parsed.data, SIG());
  return { ok: true, value: { ok: true } };
}
