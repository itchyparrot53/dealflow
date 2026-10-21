import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { BULK_MAX } from "@/constants/productivity";
import type { Db } from "@/db/client";
import { deleteOrg } from "@/features/contacts/deleteOrg";
import { deletePerson } from "@/features/contacts/deletePerson";
import { updateOrg } from "@/features/contacts/orgsRepo";
import type { ContactActor } from "@/features/contacts/personsRepo";
import { updatePerson } from "@/features/contacts/personsRepo";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// People and organizations bulk actions (6.7). Both loops call the existing update/delete services,
// so each row keeps its own permission check, change log and domain event. A partial batch returns
// E_BULK_002 with the failed ids and the count that did apply; more than BULK_MAX ids is refused
// before any write.

export type ContactBulkEntity = "person" | "organization";

export interface ContactBulkFailure {
  id: string;
  errorId: string;
}

export interface ContactBulkResult {
  applied: number;
  failed: ContactBulkFailure[];
}

function contactActor(actor: PermSetUser): ContactActor {
  return { ...actor, primaryVisibilityGroupId: null };
}

function tooMany(ids: readonly string[]): boolean {
  return ids.length > BULK_MAX;
}

export async function bulkChangeContactOwner(
  db: Db,
  actor: PermSetUser,
  entity: ContactBulkEntity,
  ids: readonly string[],
  ownerId: string,
  signal: AbortSignal,
): Promise<Result<ContactBulkResult, AppError>> {
  if (tooMany(ids)) {
    return err(new AppError(ERROR_IDS.BULK_TOO_MANY, "too many ids", { count: ids.length }));
  }
  const failures: ContactBulkFailure[] = [];
  for (const id of ids) {
    const result =
      entity === "person"
        ? await updatePerson(db, contactActor(actor), { id, ownerId }, signal)
        : await updateOrg(db, contactActor(actor), { id, ownerId }, signal);
    if (!result.ok) failures.push({ id, errorId: result.error.id });
  }
  if (failures.length > 0) {
    return err(
      new AppError(ERROR_IDS.BULK_PARTIAL, "some contacts could not be changed", {
        applied: ids.length - failures.length,
        failed: failures,
      }),
    );
  }
  return ok({ applied: ids.length, failed: failures });
}

export async function bulkDeleteContacts(
  db: Db,
  actor: PermSetUser,
  entity: ContactBulkEntity,
  ids: readonly string[],
  signal: AbortSignal,
): Promise<Result<ContactBulkResult, AppError>> {
  if (tooMany(ids)) {
    return err(new AppError(ERROR_IDS.BULK_TOO_MANY, "too many ids", { count: ids.length }));
  }
  const failures: ContactBulkFailure[] = [];
  for (const id of ids) {
    const result =
      entity === "person"
        ? await deletePerson(db, contactActor(actor), id, signal)
        : await deleteOrg(db, contactActor(actor), id, signal);
    if (!result.ok) failures.push({ id, errorId: result.error.id });
  }
  if (failures.length > 0) {
    return err(
      new AppError(ERROR_IDS.BULK_PARTIAL, "some contacts could not be deleted", {
        applied: ids.length - failures.length,
        failed: failures,
      }),
    );
  }
  return ok({ applied: ids.length, failed: failures });
}
