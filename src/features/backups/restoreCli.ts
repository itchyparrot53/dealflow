import { env } from "@/config/env";
import { restoreBackup } from "./restore";

// Shared by `pnpm backup:restore` (tsx) and the bundled image script (`node dist/backup-restore.mjs`).

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function main(): Promise<void> {
  const file = process.argv[2];
  if (file === undefined) {
    process.stderr.write("usage: backup:restore {file} [--database {name}] [--files] [--yes]\n");
    process.exit(2);
  }
  // Default target is the configured database. `--database` picks another database on the same
  // server without putting a credential-bearing URL in argv.
  const databaseName = arg("--database");
  let databaseUrl = arg("--database-url") ?? env.DATABASE_URL;
  if (databaseName !== undefined) {
    const url = new URL(env.DATABASE_URL);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();
  }
  const result = await restoreBackup(
    {
      file,
      databaseUrl,
      files: process.argv.includes("--files"),
      yes: process.argv.includes("--yes"),
    },
    AbortSignal.timeout(60 * 60 * 1000),
    { log: (line) => process.stdout.write(`${line}\n`) },
  );
  if (!result.ok) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.stdout.write(`${result.value.summary}\n`);
}
