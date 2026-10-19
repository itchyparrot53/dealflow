// Appends keys that .env lacks, with local-dev values; never rewrites or prints existing lines.
// --migrate blanks only the exact placeholder lines this script wrote in an earlier version.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const hex = (n) => randomBytes(n).toString("hex");
const b64 = (n) => randomBytes(n).toString("base64");
const DEV = {
  DATABASE_URL: "postgres://warpdrive:warpdrive@localhost:5433/warpdrive",
  BASE_URL: "http://localhost:3000",
  WS_TICKET_SECRET: hex(32),
  WS_PUBLIC_URL: "ws://localhost:8080",
  NEXT_PUBLIC_WS_URL: "ws://localhost:8080",
  MINIO_ENDPOINT: "http://localhost:9000",
  MINIO_ACCESS_KEY: hex(10),
  MINIO_SECRET_KEY: hex(24),
  MINIO_BUCKET: "warpdrive",
  TOKEN_ENCRYPTION_KEY: b64(32),
  OAUTH_SIGNING_KEY: b64(32),
  MCP_ENABLED: "true",
  GOOGLE_OAUTH_CLIENT_ID: "placeholder-dev",
  GOOGLE_OAUTH_CLIENT_SECRET: "placeholder-dev",
  GOOGLE_WORKSPACE_DOMAIN: "example.com",
  SEED_ADMIN_EMAIL: "demo1@example.com",
  ALLOW_FIRST_LOGIN_ADMIN: "true",
  BASE_CURRENCY: "USD",
};
const PLACEHOLDERS = [
  "GOOGLE_OAUTH_CLIENT_ID=placeholder-dev",
  "GOOGLE_OAUTH_CLIENT_SECRET=placeholder-dev",
  "GOOGLE_WORKSPACE_DOMAIN=example.com",
];
const exampleKeys = readFileSync(".env.example", "utf8")
  .split("\n")
  .map((l) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l))
  .filter(Boolean)
  .map((m) => [m[1], m[2]]);
const current = existsSync(".env") ? readFileSync(".env", "utf8") : "";
if (process.argv.includes("--migrate")) {
  const lines = current.split("\n");
  const next = lines.map((l) => (PLACEHOLDERS.includes(l.trim()) ? `${l.split("=")[0]}=` : l));
  writeFileSync(".env", next.join("\n"));
  console.log(
    `env-sync: blanked ${lines.filter((l) => PLACEHOLDERS.includes(l.trim())).length} placeholder line(s)`,
  );
  process.exit(0);
}
const have = new Set(
  current
    .split("\n")
    .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
    .filter(Boolean),
);
const added = [];
let out = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
for (const [key, exampleValue] of exampleKeys) {
  if (have.has(key)) continue;
  out += `${key}=${DEV[key] ?? exampleValue}\n`;
  added.push(key);
}
if (added.length > 0) appendFileSync(".env", out);
console.log(`env-sync: appended ${added.length} key(s): ${added.join(", ")}`);
