"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { moveDealToMonth } from "./forecast";

// Moving a forecast card goes through updateDeal, so it carries the same CSRF,
// permission, CAS, change-log and realtime behaviour as any other close-date edit.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function moveDealToMonthAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ dealId: string; expectedCloseDate: string }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await moveDealToMonth(db, g.value, input, SIG()));
}
