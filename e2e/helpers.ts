import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

// The e2e admin password is a fixture, not a secret: the database it signs into is created and
// dropped by scripts/e2e/e2e-server.mjs on every run.
export const E2E_ADMIN_PASSWORD = "correct horse battery staple";

export interface Fixtures {
  dealId: string;
  dealTitle: string;
  adminEmail: string;
  repEmail: string;
}

export interface CapturedMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: string;
}

export function fixtures(): Fixtures {
  return JSON.parse(readFileSync(".e2e/fixtures.json", "utf8")) as Fixtures;
}

export async function shot(page: Page, name: string): Promise<void> {
  mkdirSync("e2e/screenshots", { recursive: true });
  await page.screenshot({ path: path.join("e2e/screenshots", `${name}.png`), fullPage: true });
}

// Capture mailer files are named <Date.now()>-<uuid>.json, so name order is send order.
export function latestMail(to: string): CapturedMail | null {
  const dir = ".e2e/mail";
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();
  for (const file of files) {
    const mail = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as CapturedMail;
    if (mail.to.toLowerCase() === to.toLowerCase()) return mail;
  }
  return null;
}

export function linkFrom(mail: CapturedMail): string {
  const match = /http:\/\/localhost:3210\/\S+/.exec(mail.text);
  if (match === null) throw new Error(`no e2e link in mail "${mail.subject}"`);
  return match[0];
}
