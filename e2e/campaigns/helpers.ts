import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { CapturedMail } from "../helpers";

// The campaign spec's own fixtures and mail readers. .e2e/campaigns.json is written by
// scripts/seed-demo-campaigns.ts at the top of the e2e run; the capture mailer writes one JSON
// file per message, so the campaign and sequence assertions read the wire copy rather than the UI.

export interface CampaignPerson {
  name: string;
  email: string;
  personId: string;
}

export interface CampaignFixtures {
  filterName: string;
  sequenceId: string;
  sequenceName: string;
  newsletterId: string;
  announcementId: string;
  newsletterToken: string;
  announcementToken: string;
  e2ePeople: CampaignPerson[];
}

export interface CampaignMail extends CapturedMail {
  headers?: Record<string, string>;
}

export function campaignFixtures(): CampaignFixtures {
  return JSON.parse(readFileSync(".e2e/campaigns.json", "utf8")) as CampaignFixtures;
}

export function allMail(): CampaignMail[] {
  const dir = ".e2e/mail";
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as CampaignMail);
}

export function mailsTo(email: string): CampaignMail[] {
  const wanted = email.trim().toLowerCase();
  return allMail().filter((mail) => mail.to.trim().toLowerCase() === wanted);
}

export function campaignMails(campaignId?: string): CampaignMail[] {
  return allMail().filter((mail) => {
    const id = mail.headers?.["X-Dealflow-Campaign"];
    return id !== undefined && (campaignId === undefined || id === campaignId);
  });
}

export async function campaignShot(page: Page, name: string): Promise<void> {
  mkdirSync("e2e/screenshots/campaigns", { recursive: true });
  await page.screenshot({
    path: path.join("e2e/screenshots/campaigns", `${name}-1440-light.png`),
    fullPage: true,
  });
}

// The List-Unsubscribe header is the RFC 8058 one-click URL; the footer link is the preference
// page. Both carry the same recipient token.
export function oneClickUrl(mail: CampaignMail): string | null {
  const header = mail.headers?.["List-Unsubscribe"] ?? "";
  const match = /<([^>]+)>/.exec(header);
  return match?.[1] ?? null;
}

export function unsubscribePageUrl(mail: CampaignMail): string | null {
  const match = /http:\/\/localhost:3210\/u\/([A-Za-z0-9_-]+)(?!\/one-click)/.exec(mail.html);
  return match === null ? null : `http://localhost:3210/u/${match[1]}`;
}

export function pixelUrl(mail: CampaignMail): string | null {
  return /http:\/\/localhost:3210\/t\/c\/o\/[A-Za-z0-9_-]+\.gif/.exec(mail.html)?.[0] ?? null;
}

export function trackedLinkUrl(mail: CampaignMail): string | null {
  return /http:\/\/localhost:3210\/t\/c\/l\/[A-Za-z0-9_-]+\/\d+/.exec(mail.html)?.[0] ?? null;
}
