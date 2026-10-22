// Container smoke test (Task 6.2): a throwaway Compose project named `dealflow-smoke` builds the
// real images, boots the long-running tier, proves the health endpoint, proves a request reaches
// the app, restarts the app, and proves the seeded admin survived in Postgres. Everything it
// creates is removed on the way out, including on failure.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const PROJECT = "dealflow-smoke";
const ENV_FILE = ".smoke/smoke.env";
const BASE = "http://localhost:3310";
const ADMIN_EMAIL = "smoke@example.com";

let step = "write-env";

function log(message) {
  process.stdout.write(`[smoke] ${message}\n`);
}

function run(args, { capture = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const detail = capture
      ? `${(result.stdout ?? "").trim()}\n${(result.stderr ?? "").trim()}`.trim()
      : "";
    throw new Error(
      `docker ${args.slice(0, 3).join(" ")} failed (${String(result.status)})` +
        (detail === "" ? "" : `\n${detail}`),
    );
  }
  return result.stdout ?? "";
}

function dockerQuiet(args) {
  spawnSync("docker", args, { encoding: "utf8", stdio: "pipe" });
}

function base64Key() {
  return randomBytes(32).toString("base64");
}

function writeEnv() {
  mkdirSync(".smoke", { recursive: true });
  const env = {
    NODE_ENV: "production",
    BASE_URL: BASE,
    APP_BIND: "127.0.0.1",
    APP_PORT: "3310",
    APP_DOMAIN: "localhost:3310",
    WS_BIND: "127.0.0.1",
    WS_HOST_PORT: "3311",
    WS_PUBLIC_URL: "ws://ws:8080",
    NEXT_PUBLIC_WS_URL: "ws://localhost:3311",
    WS_TICKET_SECRET: randomBytes(32).toString("hex"),
    MINIO_BIND: "127.0.0.1",
    MINIO_PORT: "3312",
    MINIO_CONSOLE_PORT: "9001",
    MINIO_ENDPOINT: "http://localhost:3312",
    MINIO_BUCKET: "warpdrive",
    MINIO_ACCESS_KEY: `smoke-${randomBytes(4).toString("hex")}`,
    MINIO_SECRET_KEY: randomBytes(24).toString("base64url"),
    MINIO_IMAGE: "",
    MC_IMAGE: "",
    POSTGRES_USER: "warpdrive",
    POSTGRES_PASSWORD: "warpdrive",
    POSTGRES_DB: "warpdrive",
    DATABASE_URL: "postgres://warpdrive:warpdrive@postgres:5432/warpdrive",
    TOKEN_ENCRYPTION_KEY: base64Key(),
    OAUTH_SIGNING_KEY: base64Key(),
    OAUTH_REGISTRATION: "open",
    MCP_ENABLED: "true",
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    ALLOW_FIRST_LOGIN_ADMIN: "false",
    AUTH_PASSWORD_ENABLED: "true",
    AUTH_MAGIC_LINK_ENABLED: "true",
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    GOOGLE_WORKSPACE_DOMAIN: "",
    SMTP_HOST: "",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "Dealflow <dealflow@example.com>",
    MAIL_FAKE: "false",
    MAIL_CAPTURE_DIR: "",
    AI_FAKE: "true",
    OPENROUTER_API_KEY: "",
    OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
    OPENROUTER_MODEL: "deepseek/deepseek-v4.1-flash",
    BASE_CURRENCY: "USD",
    MAX_FILE_BYTES: "26214400",
    DISABLE_TELEMETRY: "true",
    DISABLE_UPDATE_CHECK: "true",
    POSTHOG_HOST: "",
    POSTHOG_KEY: "",
    ACME_EMAIL: "ops@example.com",
    APP_VERSION: "smoke",
    DEV_PG_PORT: "5433",
    MAIL_PROBE_IMAP_HOST: "",
    MAIL_PROBE_IMAP_PORT: "",
    MAIL_PROBE_SMTP_HOST: "",
    MAIL_PROBE_SMTP_PORT: "",
    MAIL_PROBE_USER: "",
    MAIL_PROBE_PASS: "",
    MAIL_PROBE_TO: "",
    DEALFLOW_ENV_FILE: ENV_FILE,
  };
  const body = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  writeFileSync(ENV_FILE, `${body}\n`, { mode: 0o600 });
}

async function pollHealth(deadlineMs) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    try {
      const response = await fetch(`${BASE}/api/health`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`health never returned 200 within ${String(deadlineMs / 60_000)} minutes`);
}

function compose(args) {
  run(["compose", "-p", PROJECT, "--env-file", ENV_FILE, ...args]);
}

function cleanup() {
  log("removing the compose project and its volumes");
  dockerQuiet(["compose", "-p", PROJECT, "--env-file", ENV_FILE, "down", "--remove-orphans"]);
  dockerQuiet(["volume", "rm", `${PROJECT}_pgdata`, `${PROJECT}_miniodata`, `${PROJECT}_backups`]);
}

async function main() {
  step = "write-env";
  writeEnv();

  step = "build-and-up";
  log("building and starting the compose stack (this can take several minutes)");
  compose(["up", "-d", "--build"]);

  step = "health";
  log("waiting for /api/health");
  await pollHealth(15 * 60_000);

  step = "magic-link-request";
  log("posting a magic-link request through the app");
  const response = await fetch(`${BASE}/auth/magic-link`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: BASE,
    },
    body: new URLSearchParams({ email: ADMIN_EMAIL }),
  });
  const location = response.headers.get("location") ?? "";
  if (response.status !== 303 || !location.includes("/login?sent=1")) {
    throw new Error(`magic link returned ${String(response.status)} to ${location}`);
  }

  step = "restart-app";
  log("restarting the app container");
  compose(["restart", "app"]);
  await pollHealth(5 * 60_000);

  step = "persisted-admin";
  const count = run(
    [
      "compose",
      "-p",
      PROJECT,
      "--env-file",
      ENV_FILE,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "warpdrive",
      "-tAc",
      `select count(*) from users where email='${ADMIN_EMAIL}' and is_admin`,
    ],
    { capture: true },
  ).trim();
  if (count !== "1") throw new Error(`expected one seeded admin, found "${count}"`);
  log("seeded admin survived the restart");

  step = "seed-deals";
  seedDeals();

  step = "backup";
  backupRoundTrip();
}

// The smoke database starts with no deals, so the backup round trip would compare 0 to 0 and
// prove nothing. Seed three deals in one pipeline and stage (created if missing) so the count is
// meaningful; the insert is idempotent by title.
function seedDeals() {
  log("seeding three deals for the backup round trip");
  const sql = `
INSERT INTO pipelines (name, "order")
SELECT 'Smoke', 0
WHERE NOT EXISTS (SELECT 1 FROM pipelines WHERE name = 'Smoke' AND is_archived = false);
INSERT INTO stages (pipeline_id, name, "order", probability)
SELECT p.id, 'Lead', 0, 50
FROM pipelines p
WHERE p.name = 'Smoke'
  AND NOT EXISTS (SELECT 1 FROM stages s WHERE s.pipeline_id = p.id AND s.name = 'Lead');
INSERT INTO deals (title, status, pipeline_id, stage_id, owner_id, visibility_level, board_position)
SELECT d.title, 'open', p.id, s.id, u.id, 'all', 0
FROM (VALUES ('Smoke renewal'), ('Smoke expansion'), ('Smoke pilot')) AS d(title)
JOIN pipelines p ON p.name = 'Smoke'
JOIN stages s ON s.pipeline_id = p.id AND s.name = 'Lead'
JOIN users u ON u.email = '${ADMIN_EMAIL}'
WHERE NOT EXISTS (SELECT 1 FROM deals x WHERE x.title = d.title AND x.deleted_at IS NULL);
`;
  compose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "warpdrive",
    "-d",
    "warpdrive",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
}

// The image's pg_dump/pg_restore round trip: dump the live smoke database inside the worker
// container, build an archive with the dump and a manifest, restore into a scratch database in
// the same Postgres, compare the deals count, then drop the scratch database. Everything stays in
// the dealflow-smoke project.
function backupRoundTrip() {
  log("checking the backup round trip inside the worker container");
  const script = `set -e
SRC="$DATABASE_URL"
BASE="\${SRC%/*}"
TARGET="$BASE/dealflow_restore_check"
rm -rf /tmp/dealflow-backup-check /tmp/dealflow-backup-check.tar.gz
mkdir -p /tmp/dealflow-backup-check
pg_dump --format=custom --no-owner --no-privileges --file=/tmp/dealflow-backup-check/db.dump "$SRC"
printf '{"version":1}' > /tmp/dealflow-backup-check/manifest.json
tar -czf /tmp/dealflow-backup-check.tar.gz -C /tmp/dealflow-backup-check .
tar -tzf /tmp/dealflow-backup-check.tar.gz | grep -q db.dump
tar -tzf /tmp/dealflow-backup-check.tar.gz | grep -q manifest.json
psql "$BASE/postgres" -c "DROP DATABASE IF EXISTS dealflow_restore_check"
psql "$BASE/postgres" -c "CREATE DATABASE dealflow_restore_check"
node dist/backup-restore.mjs /tmp/dealflow-backup-check.tar.gz --database dealflow_restore_check --yes
SRC_COUNT=$(psql "$SRC" -Atc 'select count(*) from deals')
DST_COUNT=$(psql "$TARGET" -Atc 'select count(*) from deals')
[ "$SRC_COUNT" = "$DST_COUNT" ] || { echo "deal count mismatch: $SRC_COUNT vs $DST_COUNT"; exit 1; }
psql "$BASE/postgres" -c "DROP DATABASE dealflow_restore_check"
echo "backup round trip ok ($SRC_COUNT deals)"`;
  const out = run(
    ["compose", "-p", PROJECT, "--env-file", ENV_FILE, "exec", "-T", "worker", "sh", "-c", script],
    { capture: true },
  );
  const last = out.trim().split("\n").pop() ?? "";
  if (!last.includes("backup round trip ok")) {
    throw new Error(`backup round trip did not finish: ${out}`);
  }
  log(last);
}

try {
  await main();
  log("SMOKE PASS");
  cleanup();
  process.exit(0);
} catch (error) {
  log(`SMOKE FAIL at ${step}: ${error instanceof Error ? error.message : String(error)}`);
  cleanup();
  process.exit(1);
}
