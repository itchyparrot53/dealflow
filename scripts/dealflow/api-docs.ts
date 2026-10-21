import { writeFileSync } from "node:fs";

// Regenerates docs/API.md from the route registry. Run after adding or changing a route:
//   pnpm api:docs
// The unit test docs.test.ts fails when the committed file is stale.

// The registry imports the services (so the docs describe the real routes), and some of those
// modules validate the environment at import time. Docs generation needs no real configuration,
// so fill in obviously fake values only when the process has none.
const placeholders: Record<string, string> = {
  NODE_ENV: "development",
  BASE_URL: "https://app.example.com",
  DATABASE_URL: "postgres://docs:docs@localhost:5432/docs",
  WS_TICKET_SECRET: "0".repeat(32),
  WS_PUBLIC_URL: "ws://localhost:8080",
  MINIO_ENDPOINT: "https://s3.example.com",
  MINIO_ACCESS_KEY: "docs",
  MINIO_SECRET_KEY: "docs",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  OAUTH_SIGNING_KEY: Buffer.alloc(32).toString("base64"),
  GOOGLE_OAUTH_CLIENT_ID: "",
  GOOGLE_OAUTH_CLIENT_SECRET: "",
  GOOGLE_WORKSPACE_DOMAIN: "",
};
for (const [key, value] of Object.entries(placeholders)) {
  process.env[key] ??= value;
}

async function main(): Promise<void> {
  const { buildApiDocSections, renderApiDocsMarkdown } = await import(
    "../../src/features/api/docs"
  );
  const { API_ROUTES } = await import("../../src/features/api/registry");
  writeFileSync("docs/API.md", renderApiDocsMarkdown(buildApiDocSections(API_ROUTES)));
  process.stdout.write("wrote docs/API.md from the route registry\n");
}

void main();
