import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { mintAuthToken } from "@/features/auth/authTokens";
import { ensureBootstrapAdmin } from "@/features/auth/bootstrapLocal";

// Recovery path for a lost admin: shell access to the box is the proof of ownership, so this mints
// a single-use set-password link for SEED_ADMIN_EMAIL even after bootstrap has closed.

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: rely on the process environment (the package script passes --env-file too).
}

const PREFIX = "Admin setup link (valid 24 hours, single use):";

async function main(): Promise<void> {
  const seed = (process.env.SEED_ADMIN_EMAIL ?? "").trim();
  if (seed === "") {
    console.error("SEED_ADMIN_EMAIL is not set");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "" });
  const db = drizzle(pool, { schema });
  try {
    const signal = AbortSignal.timeout(30_000);
    const created = await ensureBootstrapAdmin(
      db,
      seed,
      seed,
      { allowAfterBootstrap: true },
      signal,
    );
    if (!created.ok) {
      console.error(`bootstrap failed: ${created.error.id}: ${created.error.message}`);
      process.exitCode = 1;
      return;
    }
    if (created.value === null) {
      console.error("bootstrap returned no user");
      process.exitCode = 1;
      return;
    }
    const { token } = await mintAuthToken(db, created.value.userId, "admin_setup", signal);
    const baseUrl = (process.env.BASE_URL ?? "").replace(/\/$/, "") || "http://localhost:3000";
    console.warn(`${PREFIX} ${baseUrl}/login/invite?token=${token}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`bootstrap link failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
