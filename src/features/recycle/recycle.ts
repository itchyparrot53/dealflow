import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { RECYCLE_RETENTION_DAYS } from "@/constants/projectsApi";
import type { Db } from "@/db/client";
import {
  activities,
  changeLogs,
  deals,
  leads,
  organizations,
  persons,
  projects,
  users,
} from "@/db/schema";
import type { PermSetUser } from "@/features/permissions/effective";

// The recycle bin (6.8): soft-deleted deals, people, organizations, activities, leads and
// projects from the last 30 days. Non-admins see what they own or deleted; the delete actor comes
// from the change log because the tables carry no deleted_by column.

export const RECYCLE_ENTITIES = [
  "deal",
  "person",
  "organization",
  "activity",
  "lead",
  "project",
] as const;
export type RecycleEntity = (typeof RECYCLE_ENTITIES)[number];
export const recycleEntitySchema = z.enum(RECYCLE_ENTITIES);

export interface DeletedItem {
  entity: RecycleEntity;
  id: string;
  name: string;
  deletedAt: string;
  deletedById: string | null;
  deletedByName: string | null;
  daysLeft: number;
}

export interface RecycleFilter {
  entity?: RecycleEntity;
  search?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function recycleCutoff(now: Date): Date {
  return new Date(now.getTime() - RECYCLE_RETENTION_DAYS * DAY_MS);
}

function escapedLike(search: string): string {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

interface RawDeleted {
  entity: RecycleEntity;
  id: string;
  name: string;
  ownerId: string;
  deletedAt: Date;
}

async function entityRows(
  db: Db,
  entity: RecycleEntity,
  cutoff: Date,
  search: string,
): Promise<RawDeleted[]> {
  const pattern = escapedLike(search);
  const hasSearch = search !== "";
  switch (entity) {
    case "deal": {
      const rows = await db
        .select({
          id: deals.id,
          name: deals.title,
          ownerId: deals.ownerId,
          deletedAt: deals.deletedAt,
        })
        .from(deals)
        .where(
          and(
            gte(deals.deletedAt, cutoff),
            hasSearch ? sql`${deals.title} ILIKE ${pattern}` : sql`true`,
          ),
        );
      return rows.flatMap((row) =>
        row.deletedAt === null ? [] : [{ ...row, entity, deletedAt: row.deletedAt }],
      );
    }
    case "person": {
      const rows = await db
        .select({
          id: persons.id,
          name: persons.name,
          ownerId: persons.ownerId,
          deletedAt: persons.deletedAt,
        })
        .from(persons)
        .where(
          and(
            gte(persons.deletedAt, cutoff),
            hasSearch ? sql`${persons.name} ILIKE ${pattern}` : sql`true`,
          ),
        );
      return rows.flatMap((row) =>
        row.deletedAt === null ? [] : [{ ...row, entity, deletedAt: row.deletedAt }],
      );
    }
    case "organization": {
      const rows = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          ownerId: organizations.ownerId,
          deletedAt: organizations.deletedAt,
        })
        .from(organizations)
        .where(
          and(
            gte(organizations.deletedAt, cutoff),
            hasSearch ? sql`${organizations.name} ILIKE ${pattern}` : sql`true`,
          ),
        );
      return rows.flatMap((row) =>
        row.deletedAt === null ? [] : [{ ...row, entity, deletedAt: row.deletedAt }],
      );
    }
    case "activity": {
      const rows = await db
        .select({
          id: activities.id,
          name: activities.subject,
          ownerId: activities.ownerId,
          deletedAt: activities.deletedAt,
        })
        .from(activities)
        .where(
          and(
            gte(activities.deletedAt, cutoff),
            hasSearch ? sql`${activities.subject} ILIKE ${pattern}` : sql`true`,
          ),
        );
      return rows.flatMap((row) =>
        row.deletedAt === null ? [] : [{ ...row, entity, deletedAt: row.deletedAt }],
      );
    }
    case "lead": {
      const rows = await db
        .select({
          id: leads.id,
          name: leads.title,
          ownerId: leads.ownerId,
          deletedAt: leads.deletedAt,
        })
        .from(leads)
        .where(
          and(
            gte(leads.deletedAt, cutoff),
            hasSearch ? sql`${leads.title} ILIKE ${pattern}` : sql`true`,
          ),
        );
      return rows.flatMap((row) =>
        row.deletedAt === null ? [] : [{ ...row, entity, deletedAt: row.deletedAt }],
      );
    }
    case "project": {
      const rows = await db
        .select({
          id: projects.id,
          name: projects.name,
          ownerId: projects.ownerId,
          deletedAt: projects.deletedAt,
        })
        .from(projects)
        .where(
          and(
            gte(projects.deletedAt, cutoff),
            hasSearch ? sql`${projects.name} ILIKE ${pattern}` : sql`true`,
          ),
        );
      return rows.flatMap((row) =>
        row.deletedAt === null ? [] : [{ ...row, entity, deletedAt: row.deletedAt }],
      );
    }
  }
}

interface DeleteActor {
  actorId: string;
  actorName: string | null;
}

async function deleteActors(
  db: Db,
  rows: readonly RawDeleted[],
): Promise<Map<string, DeleteActor>> {
  if (rows.length === 0) return new Map();
  const ids = rows.map((row) => row.id);
  const logs = await db
    .select({
      entityType: changeLogs.entityType,
      entityId: changeLogs.entityId,
      actorId: changeLogs.actorId,
      actorName: users.name,
      createdAt: changeLogs.createdAt,
    })
    .from(changeLogs)
    .leftJoin(users, eq(users.id, changeLogs.actorId))
    .where(
      and(
        inArray(
          changeLogs.entityType,
          rows.map((row) => row.entity),
        ),
        inArray(changeLogs.entityId, ids),
        eq(changeLogs.field, "deleted"),
      ),
    )
    .orderBy(desc(changeLogs.createdAt));
  const map = new Map<string, DeleteActor>();
  for (const log of logs) {
    if (log.actorId === null) continue;
    const key = `${log.entityType}:${log.entityId}`;
    if (!map.has(key)) map.set(key, { actorId: log.actorId, actorName: log.actorName });
  }
  return map;
}

export async function listDeleted(
  db: Db,
  actor: PermSetUser,
  filter: RecycleFilter,
  signal: AbortSignal,
  now: Date = new Date(),
): Promise<DeletedItem[]> {
  signal.throwIfAborted();
  const cutoff = recycleCutoff(now);
  const search = filter.search?.trim() ?? "";
  const entities = filter.entity === undefined ? RECYCLE_ENTITIES : [filter.entity];
  const groups = await Promise.all(
    entities.map((entity) => entityRows(db, entity, cutoff, search)),
  );
  const rows = groups.flat();
  const actors = await deleteActors(db, rows);
  signal.throwIfAborted();

  return rows
    .filter((row) => {
      if (actor.type === "admin") return true;
      if (row.ownerId === actor.id) return true;
      return actors.get(`${row.entity}:${row.id}`)?.actorId === actor.id;
    })
    .map((row) => {
      const deletedBy = actors.get(`${row.entity}:${row.id}`);
      return {
        entity: row.entity,
        id: row.id,
        name: row.name,
        deletedAt: row.deletedAt.toISOString(),
        deletedById: deletedBy?.actorId ?? null,
        deletedByName: deletedBy?.actorName ?? null,
        daysLeft: Math.max(
          0,
          RECYCLE_RETENTION_DAYS - Math.floor((now.getTime() - row.deletedAt.getTime()) / DAY_MS),
        ),
      };
    })
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export function daysLeft(deletedAt: Date, now: Date): number {
  return Math.max(
    0,
    RECYCLE_RETENTION_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / DAY_MS),
  );
}

export { isNull };
