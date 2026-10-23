import { mkdirSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";

// Shared geometry and screenshot helpers for e2e/16-polish.spec.ts (PLAN-PART12.md 6.11).

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DESIGN_OUT = "e2e/screenshots/design";

// The dialog header uses this slot name (PLAN-PART12.md 6.2); the body and footer carry theirs.
export const DIALOG_HEADER = '[data-slot="dialog-header"]';
export const DIALOG_BODY = '[data-slot="dialog-body"]';
export const DIALOG_FOOTER = '[data-slot="dialog-footer"]';

export async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  if (value === null) throw new Error(`no bounding box for ${String(locator)}`);
  return value;
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// A truncated text node scrolls horizontally even though its client box fits its column.
export async function isEllipsized(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
}

export async function scrollToEnd(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
}

export async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(DESIGN_OUT, { recursive: true });
  await page.screenshot({ path: `${DESIGN_OUT}/${name}.png`, fullPage: true });
}

// Content is ready when the page is no longer busy, not when a timer says so: realtime sockets keep
// the network busy forever, so aria-busy is the reliable signal (the same one spec 15 uses).
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
}
