import webpush from "web-push";
import { env } from "@/config/env";

// The private key never leaves the server: `publicPushConfig` is the only shape a tRPC read or a
// client component may see.
export type PushConfig = { enabled: boolean; publicKey: string };

type VapidSource = {
  PUSH_FAKE: boolean;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
};

export function pushConfigFrom(source: VapidSource): PushConfig {
  const allSet =
    source.VAPID_PUBLIC_KEY !== "" &&
    source.VAPID_PRIVATE_KEY !== "" &&
    source.VAPID_SUBJECT !== "";
  return {
    enabled: source.PUSH_FAKE || allSet,
    publicKey: allSet ? source.VAPID_PUBLIC_KEY : "",
  };
}

export function publicPushConfig(): PushConfig {
  return pushConfigFrom(env);
}

// Capture mode needs no VAPID keys: nothing is signed or sent, only written to disk.
export function pushConfigured(): boolean {
  return publicPushConfig().enabled;
}

export function vapidDetails(): {
  subject: string;
  publicKey: string;
  privateKey: string;
} | null {
  if (env.PUSH_FAKE) return null;
  const config = publicPushConfig();
  if (!config.enabled) return null;
  return {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

// web-push keeps VAPID details in module state, so the setup is idempotent and deliberately
// skipped entirely in capture mode.
export function configureWebPush(): boolean {
  const details = vapidDetails();
  if (details === null) return false;
  webpush.setVapidDetails(details.subject, details.publicKey, details.privateKey);
  return true;
}

export function fakePushEnabled(): boolean {
  return env.PUSH_FAKE;
}

export function pushFakeDir(): string {
  return env.PUSH_FAKE_DIR;
}
