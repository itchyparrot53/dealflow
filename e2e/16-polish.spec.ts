import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { E2E_ADMIN_PASSWORD, fixtures } from "./helpers";
import {
  box,
  DIALOG_BODY,
  DIALOG_FOOTER,
  DIALOG_HEADER,
  intersects,
  isEllipsized,
  scrollToEnd,
  settle,
} from "./polish/checks";
import { runPolishGallery } from "./polish/gallery";
import { LONG_LIST_SELECT, SETTINGS_SCROLL, settingsRoutes } from "./polish/routes";

// Part 12 polish proof (PLAN-PART12.md 6.11). The ten tests are named exactly as the gates grep
// them. They fail until their task lands; none is skipped, marked fixme or narrowed.
test.use({ colorScheme: "light", storageState: ".e2e/admin.json" });
test.setTimeout(180_000);

function seeded(value: string | null, screen: string): string {
  if (value === null) throw new Error(`polish spec: no seeded record for ${screen}`);
  return value;
}

test.beforeAll(async ({ browser }) => {
  // Spec 14 signs the admin out (proving sign-out wipes offline records), which revokes the
  // session the seeded storage state carries. Re-authenticate before the polish checks so they
  // run with a live session whatever the file order.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#login-email").fill(fixtures().adminEmail);
  await page.locator("#login-password").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/pipeline/);
  await context.storageState({ path: ".e2e/admin.json" });
  await context.close();
});

test("dialog anatomy", async ({ page }) => {
  const board = `/pipeline/${seeded(fixtures().pipelineId, "board")}`;
  const dialog = page.getByRole("dialog").last();

  async function inspect(): Promise<void> {
    await expect(dialog).toBeVisible();
    const dialogBox = await box(dialog);
    const title = dialog.getByRole("heading").first();
    const titleBox = await box(title);
    // The clipped-title regression: the title used to sit above the dialog's own top edge.
    expect(titleBox.y - dialogBox.y, "title clears the dialog's top edge").toBeGreaterThanOrEqual(
      12,
    );
    expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);

    const header = dialog.locator(DIALOG_HEADER);
    const headerBox = await box(header);
    const close = dialog.getByTestId("dialog-close");
    const closeBox = await box(close);
    expect(closeBox.x).toBeGreaterThanOrEqual(headerBox.x);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
    expect(closeBox.y).toBeGreaterThanOrEqual(headerBox.y);
    // The close button must clear the header's bottom border, not sit on it.
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height - 1);

    const body = dialog.locator(DIALOG_BODY);
    await expect(body).toBeVisible();
    const footer = dialog.locator(DIALOG_FOOTER);
    const hasFooter = (await footer.count()) > 0;
    const footerBefore = hasFooter ? await box(footer) : null;
    await scrollToEnd(body);
    const headerAfter = await box(header);
    expect(headerAfter.y).toBeCloseTo(headerBox.y, 1);
    expect(headerAfter.height).toBeCloseTo(headerBox.height, 1);
    if (footerBefore !== null) {
      const footerAfter = await box(footer);
      expect(footerAfter.y).toBeCloseTo(footerBefore.y, 1);
      expect(footerAfter.height).toBeCloseTo(footerBefore.height, 1);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }

  async function addViaMenu(name: RegExp): Promise<void> {
    await page.getByTestId("global-add").click();
    await page.getByRole("menuitem", { name }).click();
  }

  await page.goto(board);
  await settle(page);
  await page.getByTestId("primary-action").click();
  await inspect();

  await addViaMenu(/^Person/);
  await inspect();

  await addViaMenu(/^Activity/);
  await inspect();

  await page.goto(`/deals/${seeded(fixtures().dealId, "deal")}`);
  await settle(page);
  await page.getByTestId("log-call").click();
  await inspect();
});

test("long list", async ({ page }) => {
  await page.goto("/settings/currencies");
  await settle(page);
  await page.getByTestId("currencies-base-select").getByRole("button").first().click();
  await page.getByPlaceholder(/^Search/).fill("zar");
  await expect(page.getByRole("option", { name: "ZAR, South African Rand" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The quarter-hour time picker is the one list that stays a Select (6.3 makes currencies and
  // time zones Comboboxes). It has 96 options, so the viewport itself must scroll.
  await page.goto(LONG_LIST_SELECT.listRoute);
  await settle(page);
  await page.locator(LONG_LIST_SELECT.rowLink).first().click();
  await settle(page);
  await page.locator(LONG_LIST_SELECT.trigger).click();
  const viewport = page.locator("[data-radix-select-viewport]").first();
  await expect(viewport).toBeVisible();
  const size = await viewport.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(size.scrollHeight, "the Select viewport scrolls").toBeGreaterThan(size.clientHeight);
  await page.keyboard.press("End");
  await expect(page.getByRole("option").last()).toBeInViewport();
});

test("rail", async ({ page }) => {
  await page.goto(`/pipeline/${seeded(fixtures().pipelineId, "board")}`);
  await settle(page);
  const rail = page.getByTestId("app-rail");
  const toggle = page.getByTestId("rail-toggle");
  const width = async (): Promise<number> => Math.round((await box(rail)).width);

  expect(await width(), "rail starts expanded").toBe(232);
  await expect(rail.getByText("Pipeline", { exact: true })).toBeVisible();

  await toggle.click();
  await expect.poll(width).toBe(56);
  await expect(rail.getByText("Pipeline", { exact: true })).toBeHidden();

  await page.reload();
  await settle(page);
  expect(await width(), "collapsed state survives a reload").toBe(56);

  await toggle.click();
  await expect.poll(width).toBe(232);
  await expect(rail.getByText("Pipeline", { exact: true })).toBeVisible();

  await page.keyboard.press("[");
  await expect.poll(width, { message: "[ toggles the rail" }).toBe(56);
});

test("hidden ui", async ({ page }) => {
  // The e2e build sets NEXT_PUBLIC_PWA_UI=true, so this asserts the flag is wired through to the
  // account menu. The off state (renders nothing) is covered by the task 2.2 unit tests.
  await page.goto("/leads");
  await settle(page);
  await page.getByRole("button", { name: "Account menu" }).click();
  // Chromium only fires beforeinstallprompt for an installable app, which a test context is not.
  // The menu entry is gated on a captured prompt, so hand the app one after the menu mounts.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = () => Promise.resolve();
    Object.defineProperty(event, "userChoice", {
      value: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
  await expect(page.getByTestId("install-app")).toBeVisible({ timeout: 10_000 });
});

test("headings", async ({ page }) => {
  for (const route of ["/documents", "/insights", "/projects", "/contacts/people", "/leads"]) {
    await page.goto(route);
    await settle(page);
    await expect(page.locator("h1:visible"), `${route} has exactly one visible h1`).toHaveCount(1);
    await expect(
      page.locator('[data-testid="top-bar"] h1:visible'),
      `${route} title lives in the top bar`,
    ).toHaveCount(1);
  }
});

test("settings scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  for (const route of settingsRoutes()) {
    await page.goto(route);
    await settle(page);
    const scroller = page.locator(SETTINGS_SCROLL);
    await expect(scroller, `${route} publishes the settings scroller`).toBeVisible();
    await scrollToEnd(scroller);
    await expect(
      scroller.locator(":scope > *").last(),
      `${route} reaches its last element`,
    ).toBeInViewport();
  }
});

test("forecast", async ({ page }) => {
  await page.goto("/forecast");
  await settle(page);
  const column = page.getByTestId("forecast-column").first();
  const total = await box(column.getByTestId("forecast-month-total"));
  const weighted = await box(column.getByTestId("forecast-month-weighted"));
  const won = await box(column.getByTestId("forecast-month-won"));
  expect(intersects(total, weighted), "Total and Weighted do not overlap").toBe(false);
  expect(intersects(total, won), "Total and Won do not overlap").toBe(false);
  expect(intersects(weighted, won), "Weighted and Won do not overlap").toBe(false);
});

test("calendar", async ({ page }) => {
  await page.goto("/activities/calendar?view=week");
  await settle(page);
  // 6.7.3 scrolls the grid so the working day starts at 08:00.
  await expect(
    page.getByTestId("time-gutter").getByText("08:00", { exact: true }),
  ).toBeInViewport();
});

test("board header", async ({ page }) => {
  await page.goto(`/pipeline/${seeded(fixtures().pipelineId, "board")}`);
  await settle(page);
  const columns = page.getByTestId("board-column");
  const count = await columns.count();
  expect(count, "the seeded board has columns").toBeGreaterThan(0);
  for (let column = 0; column < count; column += 1) {
    const texts = columns
      .nth(column)
      .locator(
        'header h2, header [data-testid="board-column-total"], header [data-testid="board-column-weighted"]',
      );
    const nodes = await texts.count();
    for (let node = 0; node < nodes; node += 1) {
      const text = (await texts.nth(node).innerText()).trim();
      expect(await isEllipsized(texts.nth(node)), `column header "${text}" is not truncated`).toBe(
        false,
      );
    }
  }
});

test("gallery", async ({ page }) => {
  test.setTimeout(300_000);
  await runPolishGallery(page);
  for (const name of [
    "add-deal",
    "currencies-open",
    "rail-expanded",
    "rail-collapsed",
    "forecast",
    "calendar",
    "document-editor",
    "thread",
    "leads",
    "dashboard",
  ]) {
    for (const theme of ["light", "dark"]) {
      const file = `e2e/screenshots/design/polish-${name}-1440-${theme}.png`;
      expect(existsSync(file), `${file} exists`).toBe(true);
    }
  }
});
