"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { changePasswordForSession } from "@/features/auth/passwordChange";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import type { ActionResult } from "@/types/actionResult";

const inputSchema = z.object({
  currentPassword: z.string().max(1024).optional(),
  newPassword: z.string().min(1).max(1024),
});

// Sets or changes the signed-in user's password. Everything that can go wrong is a value: the form
// renders the specific message for the returned id.
export async function changePasswordAction(
  raw: { currentPassword?: string; newPassword: string },
  csrfToken: string | null,
): Promise<ActionResult<{ ok: true }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };

  const { actor, session } = await createContext();
  if (actor === null || session === null) {
    return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.AUTH_INPUT_INVALID } };

  const changed = await changePasswordForSession(
    db,
    {
      actorId: actor.id,
      sessionId: session.sessionId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    },
    SIG(),
  );
  if (!changed.ok) return { ok: false, error: { id: changed.error.id } };
  return { ok: true, value: { ok: true } };
}
