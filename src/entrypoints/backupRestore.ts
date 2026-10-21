import { main } from "@/features/backups/restoreCli";

// Bundled into dist/backup-restore.mjs so the owner can run the CLI-only restore inside the
// production image (which ships no tsx). Same code as `pnpm backup:restore` for local use.
void main();
