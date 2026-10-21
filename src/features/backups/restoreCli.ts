import { restoreBackup } from "./restore";

// Shared by `pnpm backup:restore` (tsx) and the bundled image script (`node dist/backup-restore.mjs`).

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function main(): Promise<void> {
  const file = process.argv[2];
  const databaseUrl = arg("--database-url");
  if (file === undefined || databaseUrl === undefined) {
    process.stderr.write("usage: backup:restore {file} --database-url {url} [--files] [--yes]\n");
    process.exit(2);
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
