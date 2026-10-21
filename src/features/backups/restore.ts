import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { makeStorageClient, type StorageClient } from "@/features/files/storage";
import { err, ok, type Result } from "@/types/result";
import type { BackupManifest } from "./manifest";

// The CLI-only restore path (6.9): extract, show the manifest, require --yes, pg_restore into the
// given database, optionally put the files back. Never reachable from the browser.

export interface RestoreOptions {
  file: string;
  databaseUrl: string;
  files: boolean;
  yes: boolean;
}

export interface RestoreDeps {
  run?: (command: string, args: string[], signal: AbortSignal) => Promise<number>;
  storage?: Pick<StorageClient, "putObject">;
  // The CLI prints the manifest and the plan before requiring --yes.
  log?: (line: string) => void;
}

function run(command: string, args: string[], signal: AbortSignal): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { signal });
    child.on("error", () => resolve(127));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const key = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), key)));
    else out.push(key);
  }
  return out;
}

export async function restoreBackup(
  options: RestoreOptions,
  signal: AbortSignal,
  deps: RestoreDeps = {},
): Promise<Result<{ summary: string }, AppError>> {
  const log = deps.log ?? (() => undefined);
  const runStep = deps.run ?? run;
  const workDir = await mkdtemp(join(tmpdir(), "dealflow-restore-"));
  try {
    const extracted = await runStep("tar", ["-xzf", options.file, "-C", workDir], signal);
    if (extracted !== 0) {
      return err(
        new AppError(ERROR_IDS.BACKUP_FAILED, "could not extract the archive", { step: "tar" }),
      );
    }
    const manifest = JSON.parse(
      await readFile(join(workDir, "manifest.json"), "utf8"),
    ) as BackupManifest;
    log(
      `manifest: app ${manifest.appVersion}, migration ${manifest.schemaMigration}, ` +
        `${String(manifest.dbBytes)} database bytes, ${String(manifest.fileCount)} files, created ${manifest.createdAt}`,
    );
    log(`restore target: ${options.databaseUrl}`);
    log(
      options.files
        ? "the stored files will be uploaded back after the database."
        : "files will not be restored (pass --files).",
    );
    if (!options.yes) {
      return err(
        new AppError(ERROR_IDS.BACKUP_FAILED, "refusing to restore without --yes", {
          step: "confirm",
        }),
      );
    }
    const dump = join(workDir, "db.dump");
    const restored = await runStep(
      env.PG_RESTORE_PATH,
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        `--dbname=${options.databaseUrl}`,
        dump,
      ],
      signal,
    );
    if (restored !== 0) {
      return err(
        new AppError(ERROR_IDS.BACKUP_FAILED, "pg_restore failed", { step: "pg_restore" }),
      );
    }

    let fileCount = 0;
    if (options.files) {
      const storage = deps.storage ?? makeStorageClient();
      for (const key of await listFiles(join(workDir, "files"))) {
        const body = await readFile(join(workDir, "files", key));
        const put = await storage.putObject?.(key, body, signal);
        if (put === undefined || !put.ok) {
          return err(
            new AppError(ERROR_IDS.BACKUP_FAILED, "could not restore a stored file", {
              step: "files",
            }),
          );
        }
        fileCount += 1;
      }
    }

    return ok({
      summary:
        `restored ${manifest.schemaMigration} (app ${manifest.appVersion}, ${manifest.fileCount} files)` +
        (options.files ? `, re-uploaded ${String(fileCount)} files` : ""),
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
