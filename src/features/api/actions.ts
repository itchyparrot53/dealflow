"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import { createToken, revokeToken, type TokenView } from "./tokens";

// API token actions. CSRF and the session live here; the service owns "own token or admin".

const SIG = (): AbortSignal => AbortSignal.timeout(10_000);

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createTokenAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ token: string; view: TokenView }>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createToken(db, g.value, input, SIG()));
}

export async function revokeTokenAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<TokenView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await revokeToken(db, g.value, id, SIG()));
}
