import { and, eq, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { duplicateDismissals, organizations, persons } from "@/db/schema";
import { canSee } from "@/features/permissions/canSee";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import type { DuplicateEntity } from "./types";

// "Not duplicates" (6.7). The pair is stored with its ids in sorted order, so the same two records
// always land on the one unique row regardless of which side the finder saw first.

async function visibleContact(
  db: Db,
  actor: PermSetUser,
  entity: DuplicateEntity,
  id: string,
  signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted();
  if (entity === "person") {
    const [row] = await db
      .select({
        ownerId: persons.ownerId,
        visibilityLevel: persons.visibilityLevel,
        visibilityGroupId: persons.visibilityGroupId,
        visibleToUserIds: persons.visibleToUserIds,
      })
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)));
    if (row === undefined) return false;
    return canSee(actor, { kind: "person", ...row });
  }
  const [row] = await db
    .select({
      ownerId: organizations.ownerId,
      visibilityLevel: organizations.visibilityLevel,
      visibilityGroupId: organizations.visibilityGroupId,
      visibleToUserIds: organizations.visibleToUserIds,
    })
    .from(organizations)
    .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)));
  if (row === undefined) return false;
  return canSee(actor, { kind: "organization", ...row });
}

export async function dismissPair(
  db: Db,
  actor: PermSetUser,
  entity: DuplicateEntity,
  firstId: string,
  secondId: string,
  signal: AbortSignal,
): Promise<Result<{ aId: string; bId: string }, AppError>> {
  signal.throwIfAborted();
  // A pair that cannot be seen is reported as missing (no existence leak).
  if (firstId === secondId) {
    return err(new AppError(ERROR_IDS.DUP_PAIR_MISSING, "pair not found", { firstId, secondId }));
  }
  const [firstVisible, secondVisible] = await Promise.all([
    visibleContact(db, actor, entity, firstId, signal),
    visibleContact(db, actor, entity, secondId, signal),
  ]);
  if (!firstVisible || !secondVisible) {
    return err(new AppError(ERROR_IDS.DUP_PAIR_MISSING, "pair not found", { firstId, secondId }));
  }

  const [aId, bId] = [firstId, secondId].sort() as [string, string];
  await db
    .insert(duplicateDismissals)
    .values({ entity, aId, bId, dismissedBy: actor.id })
    .onConflictDoNothing();
  return ok({ aId, bId });
}
