"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { logCall } from "./calls";

export type LogCallActionResult =
  | { ok: true; value: { id: string } }
  | { ok: false; error: { id: string } };

export async function logCallAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<LogCallActionResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };

  if (!can(actor, "activity.create")) {
    return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  }

  const result = await logCall(db, actor, raw, SIG());
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}
