import { eq, lt } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { PGBOSS_QUEUE_RECYCLE_PURGE, RECYCLE_PURGE_CRON } from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";
import { activities, deals, leads, notes, organizations, persons, projects } from "@/db/schema";
import { type RecycleEntity, recycleCutoff } from "./recycle";

// The daily purge (6.8): hard-delete items deleted more than 30 days ago in foreign-key-safe
// order. A row another table still references is kept and reported, never forced: an issued
// invoice must keep its deal.

export interface PurgeSkip {
  entity: RecycleEntity | "note";
  id: string;
  reason: string;
}

export interface PurgeResult {
  deleted: number;
  skipped: PurgeSkip[];
}

interface Step {
  entity: RecycleEntity | "note";
  ids: (db: Db, cutoff: Date) => Promise<string[]>;
  remove: (db: Db, id: string) => Promise<void>;
}

const STEPS: readonly Step[] = [
  {
    entity: "activity",
    ids: async (db, cutoff) => {
      const rows = await db
        .select({ id: activities.id })
        .from(activities)
        .where(lt(activities.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(activities).where(eq(activities.id, id));
    },
  },
  {
    entity: "note",
    ids: async (db, cutoff) => {
      const rows = await db.select({ id: notes.id }).from(notes).where(lt(notes.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(notes).where(eq(notes.id, id));
    },
  },
  {
    entity: "lead",
    ids: async (db, cutoff) => {
      const rows = await db.select({ id: leads.id }).from(leads).where(lt(leads.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(leads).where(eq(leads.id, id));
    },
  },
  {
    entity: "deal",
    ids: async (db, cutoff) => {
      const rows = await db.select({ id: deals.id }).from(deals).where(lt(deals.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(deals).where(eq(deals.id, id));
    },
  },
  {
    entity: "person",
    ids: async (db, cutoff) => {
      const rows = await db
        .select({ id: persons.id })
        .from(persons)
        .where(lt(persons.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(persons).where(eq(persons.id, id));
    },
  },
  {
    entity: "organization",
    ids: async (db, cutoff) => {
      const rows = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(lt(organizations.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(organizations).where(eq(organizations.id, id));
    },
  },
  {
    entity: "project",
    ids: async (db, cutoff) => {
      const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(lt(projects.deletedAt, cutoff));
      return rows.map((row) => row.id);
    },
    remove: async (db, id) => {
      await db.delete(projects).where(eq(projects.id, id));
    },
  },
];

function reasonOf(error: unknown): string {
  const row = error as { code?: unknown; message?: unknown };
  if (row.code === "23503") return "referenced by another record";
  return typeof row.message === "string" ? row.message.slice(0, 200) : "delete failed";
}

export async function purgeExpired(
  db: Db,
  signal: AbortSignal,
  now: Date = new Date(),
): Promise<PurgeResult> {
  signal.throwIfAborted();
  const cutoff = recycleCutoff(now);
  let deleted = 0;
  const skipped: PurgeSkip[] = [];
  for (const step of STEPS) {
    const ids = await step.ids(db, cutoff);
    for (const id of ids) {
      signal.throwIfAborted();
      try {
        await step.remove(db, id);
        deleted += 1;
      } catch (error) {
        // A referenced row is kept, not forced; the job reports it so an operator can see why.
        skipped.push({ entity: step.entity, id, reason: reasonOf(error) });
      }
    }
  }
  return { deleted, skipped };
}

const JOB_TIMEOUT_MS = 5 * 60 * 1000;

export async function registerRecyclePurgeJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_RECYCLE_PURGE);
  await boss.work(PGBOSS_QUEUE_RECYCLE_PURGE, async () => {
    const result = await purgeExpired(defaultDb, AbortSignal.timeout(JOB_TIMEOUT_MS));
    if (result.skipped.length > 0) {
      console.warn("recycle purge kept referenced rows", result.skipped);
    }
    return result;
  });
  await boss.schedule(PGBOSS_QUEUE_RECYCLE_PURGE, RECYCLE_PURGE_CRON);
}
