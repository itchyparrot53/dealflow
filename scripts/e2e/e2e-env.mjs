import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

// The e2e stack runs a production build against a throwaway database. Every secret it needs is
// generated per run so no fixture value can leak into a real environment, and the only values read
// from .env are the MinIO keys (the dev MinIO container does not accept generated ones).

export function randomSecrets() {
  return {
    ws: randomBytes(32).toString("hex"),
    token: randomBytes(32).toString("base64"),
    oauth: randomBytes(32).toString("base64"),
  };
}

export function readDevMinioCreds() {
  let text = "";
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return { MINIO_ACCESS_KEY: "", MINIO_SECRET_KEY: "" };
  }
  const value = (key) => {
    for (const line of text.split("\n")) {
      const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match?.[1] === key) return match[2] ?? "";
    }
    return "";
  };
  return {
    MINIO_ACCESS_KEY: value("MINIO_ACCESS_KEY"),
    MINIO_SECRET_KEY: value("MINIO_SECRET_KEY"),
  };
}

// A generated-once VAPID pair for the e2e stack. These are test-only values committed on purpose
// (the fixture holds no secret that could reach a real push service); generating them per run
// would rotate the subscription keys every time and add nothing.
export function readVapidFixture() {
  try {
    const fixture = JSON.parse(readFileSync("e2e/fixtures/vapid.json", "utf8"));
    return {
      publicKey: fixture.publicKey,
      privateKey: fixture.privateKey,
      subject: fixture.subject ?? "mailto:e2e@example.com",
    };
  } catch {
    return { publicKey: "", privateKey: "", subject: "" };
  }
}

export function e2eEnv(secrets) {
  const vapid = readVapidFixture();
  return {
    NODE_ENV: "production",
    PORT: "3210",
    BASE_URL: "http://localhost:3210",
    DATABASE_URL: `postgres://warpdrive:warpdrive@localhost:${process.env.DEV_PG_PORT ?? "5433"}/dealflow_e2e`,
    WS_TICKET_SECRET: secrets.ws,
    WS_PUBLIC_URL: "ws://localhost:3211",
    NEXT_PUBLIC_WS_URL: "ws://localhost:3211",
    // 6.4: the e2e build keeps the install/offline/push UI visible so spec 14 still tests it.
    NEXT_PUBLIC_PWA_UI: "true",
    WS_PORT: "3211",
    MINIO_ENDPOINT: `http://localhost:${process.env.MINIO_PORT ?? "9000"}`,
    MINIO_BUCKET: "warpdrive",
    ...readDevMinioCreds(),
    TOKEN_ENCRYPTION_KEY: secrets.token,
    OAUTH_SIGNING_KEY: secrets.oauth,
    MCP_ENABLED: "true",
    // Google SSO stays off for the e2e stack: password and email-link sign-in are what the specs
    // exercise, and /auth/start must 404 so the login page hides the Google button.
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    GOOGLE_WORKSPACE_DOMAIN: "",
    SEED_ADMIN_EMAIL: "demo1@example.com",
    ALLOW_FIRST_LOGIN_ADMIN: "false",
    BASE_CURRENCY: "USD",
    DISABLE_TELEMETRY: "true",
    DISABLE_UPDATE_CHECK: "true",
    POSTHOG_KEY: "",
    POSTHOG_HOST: "",
    AUTH_PASSWORD_ENABLED: "true",
    AUTH_MAGIC_LINK_ENABLED: "true",
    SMTP_HOST: "",
    MAIL_FAKE: "true",
    MAIL_CAPTURE_DIR: ".e2e/mail",
    MAIL_PROVIDER_FAKE_DIR: ".e2e/fakemail",
    MAIL_SYNC_CADENCE_SECONDS: "5",
    MAIL_IDLE_MAX: "0",
    MAIL_INITIAL_SYNC_DAYS: "90",
    MAIL_BACKFILL_DAYS: "0",
    AI_FAKE: "true",
    // Push runs in capture mode: the spec reads .push-capture instead of calling a push service.
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_SUBJECT: vapid.subject,
    PUSH_FAKE: "true",
    PUSH_FAKE_DIR: ".push-capture",
    // The e2e spec runs a webhook receiver on 127.0.0.1, so private targets are allowed there.
    WEBHOOK_ALLOW_PRIVATE: "true",
    OPENROUTER_API_KEY: "",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
