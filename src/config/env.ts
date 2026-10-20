import { readFileSync } from "node:fs";
import { z } from "zod";
import { err, ok, type Result } from "@/types/result";

// Secret vars may be supplied as <VAR>_FILE pointing at a Docker secret file.
const SECRET_FILE_VARS = [
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SMTP_PASS",
  "OPENROUTER_API_KEY",
  "WS_TICKET_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "MINIO_SECRET_KEY",
  "DATABASE_URL",
  "OAUTH_SIGNING_KEY",
] as const;

function resolveFileVars(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...raw };
  for (const name of SECRET_FILE_VARS) {
    const filePath = raw[`${name}_FILE`];
    if (filePath != null && filePath.length > 0) {
      out[name] = readFileSync(filePath, "utf8").trim();
    }
  }
  return out;
}

const boolFromString = z.enum(["true", "false"]).transform((v) => v === "true");

const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Google SSO is optional: all three set = enabled, all three empty = disabled (superRefine below).
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
  GOOGLE_WORKSPACE_DOMAIN: z.string().default(""),
  BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  WS_TICKET_SECRET: z.string().min(32),
  WS_PUBLIC_URL: z.string().min(1),
  // Port the standalone WebSocket server binds. The app only signs tickets; src/entrypoints/ws.ts
  // reads this, and compose publishes it on the host.
  WS_PORT: z.coerce.number().int().positive().default(8080),
  // Full URL, not a bare hostname: buildMinioClient does new URL(MINIO_ENDPOINT), and the
  // browser POSTs uploads directly to the presigned host, so it must be publicly reachable
  // (e.g. https://s3.example.com), never an internal-only compose alias like "minio".
  MINIO_ENDPOINT: z.string().url(),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default("warpdrive"),
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(26_214_400),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 of exactly 32 bytes"),
  MCP_ENABLED: boolFromString.default(true),
  OAUTH_SIGNING_KEY: z.string().default(""),
  // RFC 7591 dynamic client registration. Open by default because it is what lets an MCP client
  // self-onboard with no admin step, and closing it by default would break every existing deploy
  // on upgrade. It is a knob because an open endpoint lets any stranger mint a client whose name
  // the consent screen then shows to a user, which is the setup for consent phishing: a deploy
  // that has already connected the clients it needs can set "disabled" and shut the door. An
  // enum rather than a boolean so a typo fails at boot instead of silently reading as "open".
  OAUTH_REGISTRATION: z.enum(["open", "disabled"]).default("open"),
  BASE_CURRENCY: z.string().length(3).default("USD"),
  SEED_ADMIN_EMAIL: z.string().email().or(z.literal("")).default(""),
  ALLOW_FIRST_LOGIN_ADMIN: boolFromString.default(false),
  AUTH_PASSWORD_ENABLED: boolFromString.default(true),
  AUTH_MAGIC_LINK_ENABLED: boolFromString.default(true),
  // Optional build-time stamp of the running version (e.g. a release tag). Empty when unstamped;
  // the release feature then falls back to package.json, then "dev". See resolveVersion.
  APP_VERSION: z.string().default(""),
  // Client PostHog config is passed to the browser via the server layout (props), not
  // NEXT_PUBLIC vars, so this stays the single env boundary. Empty key disables telemetry.
  POSTHOG_KEY: z.string().default(""),
  POSTHOG_HOST: z.string().default(""),
  // Off unless a deploy opts in: telemetry is opt-in for a self-hosted CRM, so the default keeps
  // a fresh install silent even when PostHog keys are present.
  DISABLE_TELEMETRY: boolFromString.default(true),
  // Console.warn/error forwarding is off by default (widens the event surface); opt in per deploy.
  TELEMETRY_CONSOLE_FORWARDING: boolFromString.default(false),
  // Git SHA of the running build, for regression attribution alongside APP_VERSION.
  APP_COMMIT: z.string().default(""),
  // System mail (magic links, invites, the first-admin setup link). An empty SMTP_HOST means log
  // mode: links are printed to the server log instead of sent, which is the local default.
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: boolFromString.default(true),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("Dealflow <no-reply@localhost>"),
  // Capture mode writes system mail to MAIL_CAPTURE_DIR as JSON. Allowed in production because
  // the e2e harness runs a production build with it on; the captured mail never leaves the box.
  MAIL_FAKE: boolFromString.default(false),
  MAIL_CAPTURE_DIR: z.string().default(".mail-capture"),
  // Filesystem fake for the IMAP/SMTP transports (tests and e2e). Non-empty = fake for every
  // IMAP account; empty = the real imapflow/nodemailer transports.
  MAIL_PROVIDER_FAKE_DIR: z.string().default(""),
  // Sync window: the first pass covers this many days, the background backfill walks back to
  // MAIL_BACKFILL_DAYS.
  MAIL_INITIAL_SYNC_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  MAIL_BACKFILL_DAYS: z.coerce.number().int().min(0).max(3650).default(365),
  // Poll cadence for every synced folder, and the cap on live IDLE connections.
  MAIL_SYNC_CADENCE_SECONDS: z.coerce.number().int().min(5).max(3600).default(90),
  MAIL_IDLE_MAX: z.coerce.number().int().min(0).max(500).default(50),
  // Messages above this size store headers and a placeholder body instead of the full source.
  MAIL_MAX_MESSAGE_BYTES: z.coerce.number().int().positive().default(15_728_640),
  // Outbound limits: recipients per rolling 24 hours, and per message.
  MAIL_SEND_DAILY_RECIPIENTS: z.coerce.number().int().positive().default(2800),
  MAIL_SEND_MAX_RECIPIENTS: z.coerce.number().int().positive().default(250),
  // AI: OpenRouter through the openai SDK. An empty key means the AI features are unavailable
  // (no client is constructed); AI_FAKE gives deterministic answers for tests and demos.
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().min(1).default("deepseek/deepseek-v4.1-flash"),
  AI_FAKE: boolFromString.default(false),
  // Off unless a deploy opts in. On by default would mean every worker polls GitHub without the
  // operator asking, so set false to get the upstream release banner.
  DISABLE_UPDATE_CHECK: boolFromString.default(true),
});

// Production guardrails for the first-run bootstrap (ops spec E6).
const schema = base.superRefine((v, ctx) => {
  // Google is all-or-nothing: a half-configured client would fail at the first redirect with a
  // confusing error, so reject it at boot instead.
  const googleConfigured = [
    v.GOOGLE_OAUTH_CLIENT_ID,
    v.GOOGLE_OAUTH_CLIENT_SECRET,
    v.GOOGLE_WORKSPACE_DOMAIN,
  ];
  const googleSet = googleConfigured.filter((value) => value !== "").length;
  if (googleSet > 0 && googleSet < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GOOGLE_OAUTH_CLIENT_ID"],
      message:
        "GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_WORKSPACE_DOMAIN must be set together",
    });
  }
  if (v.MCP_ENABLED && Buffer.from(v.OAUTH_SIGNING_KEY, "base64").length !== 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["OAUTH_SIGNING_KEY"],
      message: "OAUTH_SIGNING_KEY (base64 32 bytes) is required when MCP_ENABLED",
    });
  }
  if (v.NODE_ENV === "production") {
    if (v.ALLOW_FIRST_LOGIN_ADMIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOW_FIRST_LOGIN_ADMIN"],
        message: "ALLOW_FIRST_LOGIN_ADMIN must be false in production",
      });
    }
    if (v.SEED_ADMIN_EMAIL === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SEED_ADMIN_EMAIL"],
        message: "SEED_ADMIN_EMAIL is required in production",
      });
    }
    if (!v.AUTH_PASSWORD_ENABLED && !v.AUTH_MAGIC_LINK_ENABLED && googleSet < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_PASSWORD_ENABLED"],
        message: "at least one sign-in method must be enabled",
      });
    }
  }
});

// Named export of the full validated schema (with production guardrails) so
// boundary tests can parse a candidate env map directly.
export const envSchema = schema;

export type Env = z.infer<typeof base>;

// Pure, testable: validates a given source map without touching the global env.
export function parseEnv(raw: NodeJS.ProcessEnv): Result<Env, string> {
  const resolved = resolveFileVars(raw);
  const parsed = schema.safeParse(resolved);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return ok(parsed.data);
}

function loadOrThrow(): Env {
  const result = parseEnv(process.env);
  if (!result.ok) {
    // Fail fast at import time so misconfiguration is a boot error, not a first-use error.
    throw new Error(`Invalid environment: ${result.error}`);
  }
  return result.value;
}

export const env: Env = loadOrThrow();
