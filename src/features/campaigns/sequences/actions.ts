"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import {
  activateSequence,
  createSequence,
  deleteSequence,
  pauseSequence,
  updateSequence,
} from "./service";

// CSRF + actor are checked here; the service checks the specific permission flag. The editor sends
// the whole definition on save so the steps, entry, exit and window cannot drift apart.

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: { id: string } };

const idInput = z.object({ id: z.string().uuid() });
const updateInput = z.object({ id: z.string().uuid(), input: z.unknown() });

async function actorFromCsrf(
  csrfToken: string | null,
): Promise<{ ok: true; actor: PermSetUser } | { ok: false; error: { id: string } }> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };
  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  return { ok: true, actor };
}

export async function createSequenceAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const auth = await actorFromCsrf(csrfToken);
  if (!auth.ok) return auth;
  const result = await createSequence(db, auth.actor, raw, AbortSignal.timeout(15_000));
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

export async function updateSequenceAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string; steps: { id: string; position: number }[] }>> {
  const auth = await actorFromCsrf(csrfToken);
  if (!auth.ok) return auth;
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  const result = await updateSequence(
    db,
    auth.actor,
    parsed.data.id,
    parsed.data.input,
    AbortSignal.timeout(15_000),
  );
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}

async function simpleAction(
  raw: unknown,
  csrfToken: string | null,
  run: (
    actor: PermSetUser,
    id: string,
  ) => Promise<{ ok: true; value: { id: string } } | { ok: false; error: { id: string } }>,
): Promise<ActionResult<{ id: string }>> {
  const auth = await actorFromCsrf(csrfToken);
  if (!auth.ok) return auth;
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID } };
  return run(auth.actor, parsed.data.id);
}

export async function activateSequenceAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  return simpleAction(raw, csrfToken, async (actor, id) => {
    const result = await activateSequence(db, actor, id, AbortSignal.timeout(15_000));
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, error: { id: result.error.id } };
  });
}

export async function pauseSequenceAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  return simpleAction(raw, csrfToken, async (actor, id) => {
    const result = await pauseSequence(db, actor, id, AbortSignal.timeout(15_000));
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, error: { id: result.error.id } };
  });
}

export async function deleteSequenceAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  return simpleAction(raw, csrfToken, async (actor, id) => {
    const result = await deleteSequence(db, actor, id, AbortSignal.timeout(15_000));
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, error: { id: result.error.id } };
  });
}
