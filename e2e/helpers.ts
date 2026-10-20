import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { fakeDeliver } from "../src/features/mail/transport/fakeStore";

// The e2e admin password is a fixture, not a secret: the database it signs into is created and
// dropped by scripts/e2e/e2e-server.mjs on every run.
export const E2E_ADMIN_PASSWORD = "correct horse battery staple";

export interface Fixtures {
  dealId: string;
  dealTitle: string;
  adminEmail: string;
  repEmail: string;
  personName: string;
  personEmail: string;
  // The deal the person is on, when the seeded data links one; otherwise null.
  personDealId: string | null;
  personId: string | null;
  // The USD deal the sales spec adds its first line to; null if the seed did not create it.
  salesDealId: string | null;
  salesDealTitle: string | null;
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

export interface FakeMailInput {
  to: string;
  from: string;
  subject: string;
  messageId: string;
  text?: string;
  fromName?: string;
  inReplyTo?: string;
  references?: string[];
}

// Deliver a message into the e2e fake mailbox store (the app's IMAP provider reads it on the
// next poll).
export function deliverFakeMail(input: FakeMailInput): void {
  fakeDeliver(".e2e/fakemail", input);
}

const FAKE_ROOT = ".e2e/fakemail";

export function fakeFolder(address: string, folder: string): string[] {
  const dir = path.join(FAKE_ROOT, address.trim().toLowerCase(), folder);
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith(".eml"))
      .sort();
  } catch {
    return [];
  }
}

export function readFakeMail(address: string, folder: string, file: string): string {
  return readFileSync(path.join(FAKE_ROOT, address.trim().toLowerCase(), folder, file), "utf8");
}

// Sync runs on a five second cadence in the e2e stack, so a freshly delivered message may not be
// visible yet. Reload until the text appears instead of guessing a sleep.
export async function waitForText(page: Page, text: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const visible = await page
      .getByText(text, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return;
    await page.waitForTimeout(3_000);
    await page.reload();
  }
  throw new Error(`text never appeared: ${text}`);
}

export function linkFrom(mail: CapturedMail): string {
  const match = /http:\/\/localhost:3210\/\S+/.exec(mail.text);
  if (match === null) throw new Error(`no e2e link in mail "${mail.subject}"`);
  return match[0];
}
