"use server";

import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import type { PermSetUser } from "@/features/permissions/effective";
import { createContext } from "@/server/trpc/context";
import { type ActionResult, toClientResult } from "@/types/actionResult";
import { err, ok, type Result } from "@/types/result";
import {
  type CreatedSubscription,
  createSubscription,
  deleteSubscription,
  type Redelivery,
  redeliver,
  rotateSecret,
  type SubscriptionView,
  sendTest,
  setEnabled,
  type TestDeliveryResult,
  updateSubscription,
} from "./service";

// Webhook settings actions. CSRF and the session live here; the permission check is in the
// service so an integration test can prove the refusal.

async function guard(csrfToken: string | null): Promise<Result<PermSetUser, { id: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return err({ id: "E_AUTH_CSRF" });
  const { actor } = await createContext();
  if (actor === null) return err({ id: ERROR_IDS.AUTH_SESSION_DEAD });
  return ok(actor);
}

export async function createSubscriptionAction(
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<CreatedSubscription>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await createSubscription(db, g.value, input, SIG()));
}

export async function updateSubscriptionAction(
  id: string,
  input: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<SubscriptionView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await updateSubscription(db, g.value, id, input, SIG()));
}

export async function rotateSecretAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<string>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await rotateSecret(db, g.value, id, SIG()));
}

export async function setSubscriptionEnabledAction(
  id: string,
  enabled: boolean,
  csrfToken: string | null = null,
): Promise<ActionResult<SubscriptionView>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await setEnabled(db, g.value, id, enabled, SIG()));
}

export async function deleteSubscriptionAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<void>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await deleteSubscription(db, g.value, id, SIG()));
}

export async function sendTestAction(
  id: string,
  csrfToken: string | null = null,
): Promise<ActionResult<TestDeliveryResult>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await sendTest(db, g.value, id, SIG()));
}

export async function redeliverAction(
  deliveryId: string,
  csrfToken: string | null = null,
): Promise<ActionResult<Redelivery>> {
  const g = await guard(csrfToken);
  if (!g.ok) return g;
  return toClientResult(await redeliver(db, g.value, deliveryId, SIG()));
}
