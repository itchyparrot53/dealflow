import { main } from "@/features/backups/restoreCli";

// pnpm backup:restore {file} --database-url {url} [--files] [--yes]
// Restoring is CLI-only on purpose: the app is stopped while the database is replaced.
void main();
