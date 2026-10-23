import { spawn } from "node:child_process";
import { mkdir, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { childProcessEnv, env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { type Db, pool } from "@/db/client";
import { backupRuns, users } from "@/db/schema";
import { sendSystemEmail } from "@/features/email-design/sendSystemEmail";
import type { StorageClient } from "@/features/files/storage";
import { err, ok, type Result } from "@/types/result";
import { buildManifest } from "./manifest";
import { backupFileName, filesToPrune } from "./retention";

// One backup run (6.9): a pg_dump custom-format dump, a mirror of the storage bucket, a
// manifest, then a tar.gz in BACKUP_DIR with retention pruning. The dump password travels in
// PGPASSWORD, never in argv. Runners and the storage client are injectable so the integration
// suite can prove each step without pg_dump.

export interface BackupRunners {
  dump: (file: string, signal: AbortSignal) => Promise<{ exitCode: number }>;
  archive: (file: string, workDir: string, signal: AbortSignal) => Promise<{ exitCode: number }>;
}

export interface BackupDeps {
  dir?: string;
  keep?: number;
  enabled?: boolean;
  storage?: Pick<StorageClient, "listObjects" | "getObjectBytes">;
  runners?: BackupRunners;
  appVersion?: string;
}

export interface BackupOutcome {
  runId: string;
  fileName: string | null;
  running: boolean;
}

// Connection parts for libpq, so the URL (which embeds the password in Compose) never reaches
// argv or a log line.
function databaseConnection(): Record<string, string> {
  try {
    const parsed = new URL(env.DATABASE_URL);
    return {
      PGHOST: parsed.hostname,
      PGPORT: parsed.port === "" ? "5432" : parsed.port,
      PGUSER: decodeURIComponent(parsed.username),
      PGDATABASE: parsed.pathname.replace(/^\//, ""),
      ...(parsed.password === "" ? {} : { PGPASSWORD: decodeURIComponent(parsed.password) }),
    };
  } catch {
    return {};
  }
}

function runCommand(
  command: string,
  args: string[],
  extraEnv: Record<string, string>,
  signal: AbortSignal,
): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: childProcessEnv(extraEnv),
      signal,
    });
    child.on("error", () => resolve({ exitCode: 127 }));
    child.on("close", (code) => resolve({ exitCode: code ?? 1 }));
  });
}

export const defaultBackupRunners: BackupRunners = {
  dump: (file, signal) =>
    runCommand(
      env.PG_DUMP_PATH,
      ["--format=custom", "--no-owner", "--no-privileges", `--file=${file}`],
      databaseConnection(),
      signal,
    ),
  archive: (file, workDir, signal) =>
    runCommand("tar", ["-czf", file, "-C", workDir, "."], {}, signal),
};

function errWith(step: string, detail: string, exitCode?: number): AppError {
  return new AppError(ERROR_IDS.BACKUP_FAILED, `backup step failed: ${step}`, {
    step,
    detail,
    exitCode,
  });
}

async function latestMigration(): Promise<string> {
  try {
    const files = await readdir("drizzle");
    const sql = files.filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
    return (sql[sql.length - 1] ?? "unknown").replace(/\.sql$/, "");
  } catch {
    return "unknown";
  }
}

async function notifyFailure(db: Db, detail: string, signal: AbortSignal): Promise<void> {
  try {
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.isActive, true)));
    for (const admin of admins) {
      await sendSystemEmail(
        db,
        "backup_failed",
        admin.email,
        {
          "recipient.name": admin.email,
          "recipient.email": admin.email,
          "app.url": env.BASE_URL,
          "company.name": "",
          "backup.time": new Date().toUTCString(),
          "backup.error": detail,
          "backup.url": `${env.BASE_URL}/settings/backups`,
        },
        signal,
      );
    }
  } catch (error) {
    console.warn("backup failure email could not be sent", { error });
  }
}

async function mirrorFiles(
  storage: BackupDeps["storage"],
  workDir: string,
  signal: AbortSignal,
): Promise<{ key: string; size: number }[]> {
  if (storage === undefined || storage.listObjects === undefined) {
    throw errWith("files", "storage client cannot list objects");
  }
  const listed = await storage.listObjects(signal);
  if (!listed.ok) throw errWith("files", listed.error.id);
  const manifestFiles: { key: string; size: number }[] = [];
  for (const object of listed.value) {
    const bytes = await storage.getObjectBytes(object.key, signal);
    if (!bytes.ok) throw errWith("files", bytes.error.id);
    const target = join(workDir, "files", object.key);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, bytes.value);
    manifestFiles.push({ key: object.key, size: bytes.value.length });
  }
  return manifestFiles;
}

async function executeRun(
  db: Db,
  options: { trigger: "schedule" | "manual"; startedBy: string | null },
  deps: BackupDeps,
  signal: AbortSignal,
): Promise<Result<BackupOutcome, AppError>> {
  const dir = deps.dir ?? env.BACKUP_DIR;
  const keep = deps.keep ?? env.BACKUP_KEEP;
  const runners = deps.runners ?? defaultBackupRunners;
  const now = new Date();
  const fileName = backupFileName(now);

  const [run] = await db
    .insert(backupRuns)
    .values({ status: "running", trigger: options.trigger, startedBy: options.startedBy })
    .returning({ id: backupRuns.id });
  if (run === undefined) {
    return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "backup run insert failed"));
  }
  const workDir = join(dir, `.tmp-${run.id}`);
  const archivePath = join(dir, fileName);
  let step = "prepare";

  try {
    await mkdir(join(workDir, "files"), { recursive: true });
    signal.throwIfAborted();

    step = "pg_dump";
    const dumpFile = join(workDir, "db.dump");
    const dumped = await runners.dump(dumpFile, signal);
    if (dumped.exitCode !== 0) {
      throw errWith("pg_dump", `pg_dump exited ${String(dumped.exitCode)}`, dumped.exitCode);
    }
    const dbStat = await stat(dumpFile);

    step = "files";
    const manifestFiles = await mirrorFiles(deps.storage, workDir, signal);

    step = "manifest";
    const manifest = buildManifest({
      createdAt: now,
      appVersion: deps.appVersion ?? (env.APP_VERSION === "" ? "dev" : env.APP_VERSION),
      dbBytes: dbStat.size,
      files: manifestFiles,
      schemaMigration: await latestMigration(),
    });
    await writeFile(join(workDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    step = "tar";
    const archived = await runners.archive(archivePath, workDir, signal);
    if (archived.exitCode !== 0) {
      throw errWith("tar", `tar exited ${String(archived.exitCode)}`, archived.exitCode);
    }
    const archiveStat = await stat(archivePath);

    step = "finish";
    await db
      .update(backupRuns)
      .set({
        fileName,
        status: "succeeded",
        sizeBytes: archiveStat.size,
        dbBytes: dbStat.size,
        fileCount: manifestFiles.length,
        finishedAt: new Date(),
      })
      .where(eq(backupRuns.id, run.id));

    await rm(workDir, { recursive: true, force: true });
    const names = await readdir(dir);
    for (const name of filesToPrune(names, keep)) {
      await unlink(join(dir, name)).catch(() => undefined);
    }
    return ok({ runId: run.id, fileName, running: false });
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : errWith(step, error instanceof Error ? error.message : String(error));
    const rawDetail = appError.context?.detail ?? appError.message;
    const detail = (typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail)).slice(
      0,
      500,
    );
    await db
      .update(backupRuns)
      .set({
        status: "failed",
        errorId: appError.id,
        errorDetail: detail,
        finishedAt: new Date(),
      })
      .where(eq(backupRuns.id, run.id));
    await rm(workDir, { recursive: true, force: true });
    await unlink(archivePath).catch(() => undefined);
    await notifyFailure(db, detail, signal);
    return err(appError);
  }
}

const BACKUP_LOCK_KEY = "dealflow_backup";

export async function runBackup(
  db: Db,
  options: { trigger: "schedule" | "manual"; startedBy?: string | null },
  signal: AbortSignal,
  deps: BackupDeps = {},
): Promise<Result<BackupOutcome, AppError>> {
  if ((deps.enabled ?? env.BACKUP_ENABLED) === false) {
    return err(new AppError(ERROR_IDS.BACKUP_UNAVAILABLE, "backups are disabled"));
  }
  const dir = deps.dir ?? env.BACKUP_DIR;
  const probe = join(dir, `.write-check-${String(Date.now())}`);
  try {
    await mkdir(dir, { recursive: true });
    // An existing read-only directory survives mkdir; only a real write proves writability.
    await writeFile(probe, "");
    await unlink(probe);
  } catch {
    return err(new AppError(ERROR_IDS.BACKUP_UNAVAILABLE, "BACKUP_DIR is not writable", { dir }));
  }

  const client = await pool.connect();
  try {
    const lockedResult = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as locked",
      [BACKUP_LOCK_KEY],
    );
    if (lockedResult.rows[0]?.locked !== true) {
      const [running] = await db
        .select({ id: backupRuns.id, fileName: backupRuns.fileName })
        .from(backupRuns)
        .where(eq(backupRuns.status, "running"))
        .limit(1);
      return ok({
        runId: running?.id ?? "",
        fileName: running?.fileName ?? null,
        running: true,
      });
    }
    try {
      return await executeRun(
        db,
        { trigger: options.trigger, startedBy: options.startedBy ?? null },
        deps,
        signal,
      );
    } finally {
      await client
        .query("select pg_advisory_unlock(hashtext($1))", [BACKUP_LOCK_KEY])
        .catch(() => undefined);
    }
  } finally {
    client.release();
  }
}
