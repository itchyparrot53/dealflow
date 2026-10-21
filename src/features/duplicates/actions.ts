"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { dismissPair } from "./dismiss";
import type { DuplicateEntity } from "./types";

export type DismissDuplicateResult = { ok: true } | { ok: false; error: { id: string } };

export async function dismissDuplicateAction(
  input: { entity: DuplicateEntity; aId: string; bId: string },
  csrfToken: string | null = null,
): Promise<DismissDuplicateResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };

  const result = await dismissPair(db, actor, input.entity, input.aId, input.bId, SIG());
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true };
}
