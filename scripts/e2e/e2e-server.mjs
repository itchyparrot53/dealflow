import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import pg from "pg";
import { e2eEnv, randomSecrets } from "./e2e-env.mjs";

// Owns the whole e2e stack: a throwaway database, demo data, a signed-in state, then the app and
// the WebSocket server. Playwright starts this file and stops it; nothing here may outlive it.

const DEV_PG_PORT = process.env.DEV_PG_PORT ?? "5433";
const ADMIN_URL = `postgres://warpdrive:warpdrive@localhost:${DEV_PG_PORT}/postgres`;
const env = { ...process.env, ...e2eEnv(randomSecrets()) };

function fail(message) {
  console.error(`e2e: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} exited with ${result.status}`);
}

// 1. Fresh capture folder: every run must see only its own mail.
rmSync(".e2e", { recursive: true, force: true });
mkdirSync(".e2e/mail", { recursive: true });

// 2. Throwaway database. FORCE terminates stale connections from a previous crashed run.
const admin = new pg.Client({ connectionString: ADMIN_URL });
try {
  await admin.connect();
} catch {
  fail("dev Postgres is not reachable, run pnpm dev:up");
}
await admin.query("DROP DATABASE IF EXISTS dealflow_e2e WITH (FORCE)");
await admin.query("CREATE DATABASE dealflow_e2e");
await admin.end();

const setup = new pg.Client({ connectionString: env.DATABASE_URL });
await setup.connect();
await setup.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
await setup.query("CREATE EXTENSION IF NOT EXISTS citext");
await setup.end();

// 3. Schema, demo data, signed-in storage states.
run("pnpm", ["exec", "tsx", "src/entrypoints/migrate.ts"]);
run("pnpm", ["exec", "tsx", "scripts/seed-demo.ts"]);
run("pnpm", ["exec", "tsx", "scripts/e2e/seed-session.ts"]);

// 4. The app and the WebSocket server.
const children = [
  spawn("pnpm", ["exec", "tsx", "src/entrypoints/ws.ts"], { env, stdio: "inherit" }),
  // The worker creates the pg-boss queues. A production build rejects activity creates when no
  // boss is present (a deliberate guard), so the harness runs the same worker tier the compose
  // stack runs.
  spawn("pnpm", ["exec", "tsx", "src/entrypoints/worker.ts"], { env, stdio: "inherit" }),
  spawn("pnpm", ["exec", "next", "start", "-p", "3210"], { env, stdio: "inherit" }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) {
      // One half of the stack died: the other is useless, and Playwright must see a failure.
      console.error(`e2e: child exited with ${code}`);
      stop(1);
    }
  });
}
