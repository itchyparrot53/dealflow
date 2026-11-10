"use server";

import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { bulkEnrollInSequence } from "@/features/campaigns/sequences/enroll";
import { guardCsrf } from "@/features/identity/actions/shared";
import { SIG } from "@/features/identity/actions/sig";
import { createContext } from "@/server/trpc/context";
import { bulkChangeContactOwner, bulkDeleteContacts, type ContactBulkFailure } from "./bulk";

const inputSchema = z
  .object({
    entity: z.enum(["person", "organization"]),
    kind: z.enum(["owner", "delete", "enroll_sequence"]),
    ids: z.array(z.string().uuid()).min(1),
    ownerId: z.string().uuid().optional(),
    sequenceId: z.string().uuid().optional(),
  })
  .strict();

export type ContactBulkActionResult =
  | { ok: true; value: { applied: number; alreadyActive?: number } }
  | { ok: false; error: { id: string; failed: ContactBulkFailure[] } };

export async function bulkContactAction(
  raw: unknown,
  csrfToken: string | null = null,
): Promise<ContactBulkActionResult> {
  const csrfOk = await guardCsrf(csrfToken);
  if (!csrfOk.ok) return { ok: false, error: { id: "E_AUTH_CSRF", failed: [] } };

  const { actor } = await createContext();
  if (actor === null) {
    return { ok: false, error: { id: ERROR_IDS.AUTH_SESSION_DEAD, failed: [] } };
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { id: ERROR_IDS.BULK_TOO_MANY, failed: [] } };
  }
  const { entity, kind, ids, ownerId, sequenceId } = parsed.data;

  if (kind === "owner" && ownerId === undefined) {
    return { ok: false, error: { id: ERROR_IDS.BULK_TOO_MANY, failed: [] } };
  }
  if (kind === "enroll_sequence") {
    if (entity !== "person" || sequenceId === undefined) {
      return { ok: false, error: { id: ERROR_IDS.CAMPAIGN_INPUT_INVALID, failed: [] } };
    }
    const enrolled = await bulkEnrollInSequence(db, actor, sequenceId, ids, SIG());
    if (!enrolled.ok) {
      return { ok: false, error: { id: enrolled.error.id, failed: [] } };
    }
    return {
      ok: true,
      value: {
        applied: enrolled.value.enrolled,
        alreadyActive: enrolled.value.alreadyActive,
      },
    };
  }

  const result =
    kind === "owner" && ownerId !== undefined
      ? await bulkChangeContactOwner(db, actor, entity, ids, ownerId, SIG())
      : await bulkDeleteContacts(db, actor, entity, ids, SIG());

  if (!result.ok) {
    const failed = (result.error.context?.failed ?? []) as ContactBulkFailure[];
    return { ok: false, error: { id: result.error.id, failed } };
  }
  return { ok: true, value: { applied: result.value.applied } };
}
