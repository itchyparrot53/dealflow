import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  activities,
  changeLogs,
  deals,
  leads,
  organizations,
  persons,
  projects,
} from "@/db/schema";
import { recordChange } from "@/features/collaboration/changeLog";
import type { PermSetUser } from "@/features/permissions/effective";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { type RecycleEntity, recycleCutoff, recycleEntitySchema } from "./recycle";

// Restore one recycle-bin item. A user may restore what they own or deleted; an admin anything.
// The restore clears deleted_at through recordChange, so the change log and the domain event
// (deal.updated for a restored deal) are written with the same transaction.

export const restoreInput = z.object({ entity: recycleEntitySchema, id: z.uuid() });

interface RestorableRow {
  id: string;
  ownerId: string;
  deletedAt: Date;
}

async function loadRow(db: Db, entity: RecycleEntity, id: string): Promise<RestorableRow | null> {
  const [row] = await tableSelect(db, entity, id);
  if (row === undefined || row.deletedAt === null) return null;
  return { id: row.id, ownerId: row.ownerId, deletedAt: row.deletedAt };
}

function tableSelect(db: Db, entity: RecycleEntity, id: string) {
  switch (entity) {
    case "deal":
      return db
        .select({ id: deals.id, ownerId: deals.ownerId, deletedAt: deals.deletedAt })
        .from(deals)
        .where(eq(deals.id, id));
    case "person":
      return db
        .select({ id: persons.id, ownerId: persons.ownerId, deletedAt: persons.deletedAt })
        .from(persons)
        .where(eq(persons.id, id));
    case "organization":
      return db
        .select({
          id: organizations.id,
          ownerId: organizations.ownerId,
          deletedAt: organizations.deletedAt,
        })
        .from(organizations)
        .where(eq(organizations.id, id));
    case "activity":
      return db
        .select({
          id: activities.id,
          ownerId: activities.ownerId,
          deletedAt: activities.deletedAt,
        })
        .from(activities)
        .where(eq(activities.id, id));
    case "lead":
      return db
        .select({ id: leads.id, ownerId: leads.ownerId, deletedAt: leads.deletedAt })
        .from(leads)
        .where(eq(leads.id, id));
    case "project":
      return db
        .select({ id: projects.id, ownerId: projects.ownerId, deletedAt: projects.deletedAt })
        .from(projects)
        .where(eq(projects.id, id));
  }
}

async function deletedBy(db: Db, entity: RecycleEntity, id: string): Promise<string | null> {
  const [row] = await db
    .select({ actorId: changeLogs.actorId })
    .from(changeLogs)
    .where(
      and(
        eq(changeLogs.entityType, entity),
        eq(changeLogs.entityId, id),
        eq(changeLogs.field, "deleted"),
      ),
    )
    .orderBy(desc(changeLogs.createdAt))
    .limit(1);
  return row?.actorId ?? null;
}

async function stillDeleted(
  db: Db,
  entity: "deal" | "person" | "organization",
  id: string,
): Promise<boolean> {
  switch (entity) {
    case "deal": {
      const [row] = await db
        .select({ deletedAt: deals.deletedAt })
        .from(deals)
        .where(eq(deals.id, id));
      return row !== undefined && row.deletedAt !== null;
    }
    case "person": {
      const [row] = await db
        .select({ deletedAt: persons.deletedAt })
        .from(persons)
        .where(eq(persons.id, id));
      return row !== undefined && row.deletedAt !== null;
    }
    case "organization": {
      const [row] = await db
        .select({ deletedAt: organizations.deletedAt })
        .from(organizations)
        .where(eq(organizations.id, id));
      return row !== undefined && row.deletedAt !== null;
    }
  }
}

// A record whose parent is still deleted cannot be restored yet (E_RECYCLE_002).
async function blockedProject(
  db: Db,
  id: string,
): Promise<{ parent: string; parentId: string } | null> {
  const [row] = await db
    .select({ dealId: projects.dealId })
    .from(projects)
    .where(eq(projects.id, id));
  if (row?.dealId != null && (await stillDeleted(db, "deal", row.dealId))) {
    return { parent: "deal", parentId: row.dealId };
  }
  return null;
}

async function blockedPerson(
  db: Db,
  id: string,
): Promise<{ parent: string; parentId: string } | null> {
  const [row] = await db.select({ orgId: persons.orgId }).from(persons).where(eq(persons.id, id));
  if (row?.orgId != null && (await stillDeleted(db, "organization", row.orgId))) {
    return { parent: "organization", parentId: row.orgId };
  }
  return null;
}

async function blockedActivity(
  db: Db,
  id: string,
): Promise<{ parent: string; parentId: string } | null> {
  const [row] = await db
    .select({
      dealId: activities.dealId,
      personId: activities.personId,
      orgId: activities.orgId,
    })
    .from(activities)
    .where(eq(activities.id, id));
  if (row === undefined) return null;
  if (row.dealId !== null && (await stillDeleted(db, "deal", row.dealId))) {
    return { parent: "deal", parentId: row.dealId };
  }
  if (row.personId !== null && (await stillDeleted(db, "person", row.personId))) {
    return { parent: "person", parentId: row.personId };
  }
  if (row.orgId !== null && (await stillDeleted(db, "organization", row.orgId))) {
    return { parent: "organization", parentId: row.orgId };
  }
  return null;
}

async function blockedParent(
  db: Db,
  entity: RecycleEntity,
  id: string,
): Promise<{ parent: string; parentId: string } | null> {
  switch (entity) {
    case "project":
      return blockedProject(db, id);
    case "person":
      return blockedPerson(db, id);
    case "activity":
      return blockedActivity(db, id);
    case "deal":
    case "organization":
    case "lead":
      return null;
  }
}

const TABLE_NAME: Record<RecycleEntity, string> = {
  deal: "deals",
  person: "persons",
  organization: "organizations",
  activity: "activities",
  lead: "leads",
  project: "projects",
};

async function clearDeletedAt(db: DbOrTx, entity: RecycleEntity, id: string): Promise<void> {
  // A raw UPDATE because Drizzle's builder does not type-resolve over the Db | Tx union; the
  // table name comes from the constant map above, never from input.
  await db.execute(
    sql`UPDATE ${sql.raw(`"${TABLE_NAME[entity]}"`)} SET deleted_at = NULL WHERE id = ${id}::uuid`,
  );
}

export async function restoreItem(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
  now: Date = new Date(),
): Promise<Result<{ id: string }, AppError>> {
  const parsed = restoreInput.safeParse(raw);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.RECYCLE_NOT_FOUND, "invalid restore input", {
        issues: parsed.error.issues,
      }),
    );
  }
  const { entity, id } = parsed.data;
  const row = await loadRow(db, entity, id);
  if (row === null) {
    return err(
      new AppError(ERROR_IDS.RECYCLE_NOT_FOUND, "item not found or already restored", { id }),
    );
  }
  const cutoff = recycleCutoff(now);
  if (row.deletedAt < cutoff) {
    // Past the window: the purge owns it, restoring would resurrect what retention removes.
    return err(
      new AppError(ERROR_IDS.RECYCLE_NOT_FOUND, "item is past the retention window", { id }),
    );
  }
  const deletedActor = await deletedBy(db, entity, id);
  const permitted = actor.type === "admin" || row.ownerId === actor.id || deletedActor === actor.id;
  if (!permitted) {
    return err(new AppError(ERROR_IDS.RECYCLE_NOT_FOUND, "not restorable by this user", { id }));
  }

  const blocked = await blockedParent(db, entity, id);
  if (blocked !== null) {
    return err(
      new AppError(ERROR_IDS.RECYCLE_PARENT_DELETED, "its parent is still deleted", blocked),
    );
  }

  await db.transaction(async (tx) => {
    await clearDeletedAt(tx, entity, id);
    await recordChange(
      tx,
      {
        entityType: entity,
        entityId: id,
        field: "deleted",
        oldValue: true,
        newValue: false,
        actorId: actor.id,
      },
      signal,
    );
  });
  signal.throwIfAborted();
  return ok({ id });
}
