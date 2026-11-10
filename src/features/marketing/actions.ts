"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { CONSENT_BASES, MARKETING_STATUSES } from "@/constants/marketing";
import { db } from "@/db/client";
import { guardCsrf } from "@/features/identity/actions/shared";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { bulkChangeMarketingStatus, MARKETING_BULK_MAX } from "./bulk";
import { transitionMarketingStatus } from "./service";

// 6.12 mutations. Both check CSRF, the actor and marketing.manage; the consent service owns the
// transition table and the evidence.

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: { id: string } };

const changeInput = z.object({
  personId: z.string().uuid(),
  to: z.enum(MARKETING_STATUSES),
  basis: z.enum(CONSENT_BASES).nullable().optional(),
});

const bulkInput = z.object({
  personIds: z.array(z.string().uuid()).min(1).max(MARKETING_BULK_MAX),
  to: z.enum(MARKETING_STATUSES),
  basis: z.enum(CONSENT_BASES).nullable().optional(),
});

export async function changeMarketingStatusAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ status: string }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };
  if (!can(actor, "marketing.manage")) {
    return { ok: false, error: { id: ERROR_IDS.PERM_DENIED } };
  }
  const parsed = changeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.MARKETING_INPUT_INVALID } };

  const result = await transitionMarketingStatus(
    db,
    {
      personId: parsed.data.personId,
      to: parsed.data.to,
      source: "manual",
      basis: parsed.data.basis ?? null,
      actorUserId: actor.id,
    },
    AbortSignal.timeout(15_000),
  );
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: { status: result.value.status } };
}

export async function bulkMarketingStatusAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ActionResult<{ applied: number }>> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF" } };

  const { actor } = await createContext();
  if (actor === null) return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD } };

  const parsed = bulkInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { id: ERROR_IDS.MARKETING_INPUT_INVALID } };

  const result = await bulkChangeMarketingStatus(
    db,
    actor,
    {
      personIds: parsed.data.personIds,
      to: parsed.data.to,
      basis: parsed.data.basis ?? null,
    },
    AbortSignal.timeout(60_000),
  );
  if (!result.ok) return { ok: false, error: { id: result.error.id } };
  return { ok: true, value: result.value };
}
