import { expect, type Page } from "@playwright/test";
import { fixtures } from "../helpers";
import { box, settle, shot } from "./checks";

// The ten polish screens of PLAN-PART12.md 6.11, each captured in both themes. A colour-scheme
// change plus a reload is the real appearance path (the seeded users default to "system"), so the
// dark shots go through AppearanceSync instead of faking the class.

function requireId(value: string | null, screen: string): string {
  if (value === null) throw new Error(`polish gallery: no seeded record for ${screen}`);
  return value;
}

type Interact = () => Promise<void>;

async function capture(
  page: Page,
  name: string,
  route: string,
  interact?: Interact,
): Promise<void> {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(route);
  await settle(page);
  await interact?.();
  await shot(page, `polish-${name}-1440-light`);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await settle(page);
  await interact?.();
  await shot(page, `polish-${name}-1440-dark`);
  await page.emulateMedia({ colorScheme: "light" });
}

// The rail state lives in a cookie, so a capture must assert the state instead of clicking blind:
// the dark pass reloads the page and inherits whatever the light pass left behind.
async function ensureRail(page: Page, state: "expanded" | "collapsed"): Promise<void> {
  const rail = page.getByTestId("app-rail");
  const expected = state === "expanded" ? 232 : 56;
  if (Math.round((await box(rail)).width) === expected) return;
  await page.getByTestId("rail-toggle").click();
  await expect.poll(async () => Math.round((await box(rail)).width)).toBe(expected);
}

export async function runPolishGallery(page: Page): Promise<void> {
  const f = fixtures();
  const board = `/pipeline/${requireId(f.pipelineId, "board")}`;

  await capture(page, "rail-expanded", board, async () => {
    await ensureRail(page, "expanded");
  });
  await capture(page, "rail-collapsed", board, async () => {
    await ensureRail(page, "collapsed");
  });
  // Restore the default before the other screens, so the rest of the gallery shows the real shell.
  await page.goto(board);
  await settle(page);
  await ensureRail(page, "expanded");

  await capture(page, "add-deal", board, async () => {
    await page.getByTestId("primary-action").click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
  await capture(page, "currencies-open", "/settings/currencies", async () => {
    await page.getByTestId("currencies-base-select").getByRole("button").first().click();
    await expect(page.getByRole("combobox")).toBeVisible();
  });
  await capture(page, "forecast", "/forecast");
  await capture(page, "calendar", "/activities/calendar?view=week");
  await capture(page, "document-editor", `/documents/${requireId(f.documentId, "document")}`);
  await capture(page, "thread", `/inbox/${requireId(f.threadId, "thread")}`);
  await capture(page, "leads", "/leads");
  await capture(page, "dashboard", `/insights/dashboards/${requireId(f.dashboardId, "dashboard")}`);
}
