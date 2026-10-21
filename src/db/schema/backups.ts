import { sql } from "drizzle-orm";
import { bigint, check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";

// Part 8 backups: one row per run so /settings/backups can show progress and history. The archive
// itself lives on disk under BACKUP_DIR; only its name and sizes are recorded here.

export const backupRuns = pgTable(
  "backup_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileName: text("file_name"),
    status: text("status").notNull(),
    // `trigger` is a reserved word in Postgres; the quoted identifier is fine and matches the plan.
    trigger: text("trigger").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    dbBytes: bigint("db_bytes", { mode: "number" }),
    fileCount: integer("file_count"),
    errorId: text("error_id"),
    errorDetail: text("error_detail"),
    startedBy: uuid("started_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    check("backup_runs_status_ck", sql`${t.status} in ('running','succeeded','failed')`),
    check("backup_runs_trigger_ck", sql`${t.trigger} in ('schedule','manual')`),
    check("backup_runs_error_detail_ck", sql`char_length(${t.errorDetail}) <= 500`),
  ],
);

export type BackupRun = typeof backupRuns.$inferSelect;
