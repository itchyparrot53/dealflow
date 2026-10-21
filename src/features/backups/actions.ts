"use server";

import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { runBackup } from "./backup";

const SIG = (): AbortSignal => AbortSignal.timeout(10 * 60 * 1000);

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function backUpNowAction(
  csrfToken: string | null = null,
): Promise<ActionResult<{ runId: string; fileName: string | null; running: boolean }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  if (g.value.type !== "admin") {
    return toClientResult(err(new AppError(ERROR_IDS.PERM_DENIED, "admin required")));
  }
  return toClientResult(await runBackup(db, { trigger: "manual", startedBy: g.value.id }, SIG()));
}
