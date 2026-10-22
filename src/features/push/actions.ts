"use server";

import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { setPushPref } from "./prefs";
import { pushPrefInput, pushSubscribeInput, pushUnsubscribeInput } from "./schemas";
import { subscribePush, unsubscribePush } from "./subscriptions";

type ActionResult<T = Record<string, never>> =
  | { ok: true; value: T }
  | { ok: false; error: { id: string } };

export async function subscribePushAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor, db } = await createContext();
  if (actor === null) return { ok: false, error: { id: "E_AUTH_003" } };

  const parsed = pushSubscribeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: { id: "E_PUSH_004" } };

  const result = await subscribePush(db, actor, parsed.data, SIG());
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: {} };
}

export async function unsubscribePushAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor, db } = await createContext();
  if (actor === null) return { ok: false, error: { id: "E_AUTH_003" } };

  const parsed = pushUnsubscribeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: { id: "E_PUSH_004" } };

  const result = await unsubscribePush(db, actor, parsed.data.endpoint, SIG());
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: {} };
}

export async function setPushPrefAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor, db } = await createContext();
  if (actor === null) return { ok: false, error: { id: "E_AUTH_003" } };

  const parsed = pushPrefInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: { id: "E_PUSH_004" } };

  await setPushPref(db, actor.id, parsed.data.type, parsed.data.enabled, SIG());
  return { ok: true, value: {} };
}
