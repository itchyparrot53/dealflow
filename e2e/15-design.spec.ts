import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { type DesignRoute, designRoutes, selectedScreens } from "./design/routes";
import { runStyleChecks } from "./design/styleChecks";
import { fixtures } from "./helpers";

// Part 11 design gallery (PLAN-PART11.md 6.10). Public screens run signed out and always light;
// app screens run as the seeded admin. DESIGN_SCREENS narrows a run while the restyle is in
// progress, and DESIGN_CHECKS=0 skips the computed-value parity table.
const OUT = "e2e/screenshots/design";
mkdirSync(OUT, { recursive: true });

const CHECKS = process.env.DESIGN_CHECKS !== "0";
const ALL = designRoutes(fixtures());
const SELECTED = selectedScreens(ALL, process.env.DESIGN_SCREENS);

// The host machine may be in dark mode; the light pass must be deterministic. The dark pass
// overrides this per page with emulateMedia.
test.use({ colorScheme: "light" });

test.setTimeout(180_000);

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  // Realtime sockets can keep the network busy forever; the aria-busy assertion below is the
  // part that actually gates on content being ready.
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Sandboxed HTML-email bodies are third-party documents; axe cannot audit across them.
    .exclude("iframe")
    .analyze();
  const failing = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${violation.id}: ${violation.help} [${violation.nodes
          .map((node) => {
            const data = node.any[0]?.data as Record<string, unknown> | undefined;
            const detail = data === undefined ? "" : ` (${JSON.stringify(data).replace(/"/g, "")})`;
            return `${node.target.join(" ")}${detail}`;
          })
          .join(", ")}]`,
    );
  expect(failing).toEqual([]);
}

// Screens whose default view can legitimately be empty (the activities list opens on "Today" for
// the signed-in owner) are nudged to a populated view before axe and the screenshot.
const PREPARE: Record<string, (page: Page) => Promise<void>> = {
  "activities-list": async (page) => {
    await page.getByRole("button", { name: "To-do" }).click();
    await page.getByRole("button", { name: "Owner" }).click();
    await page.getByRole("option", { name: "All owners" }).click();
    await expect(page.getByTestId("table-row").first()).toBeVisible({ timeout: 30_000 });
  },
};

async function runScreen(page: Page, route: DesignRoute): Promise<void> {
  await page.goto(route.path());
  await settle(page);
  await PREPARE[route.id]?.(page);
  await settle(page);
  if (route.app) await expect(page).not.toHaveURL(/\/login/);
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: `${OUT}/${route.id}-1440-light.png`, fullPage: true });
  if (CHECKS) await runStyleChecks(page, route.id);

  await page.setViewportSize({ width: 375, height: 812 });
  await settle(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${route.id} must not scroll horizontally at 375`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${OUT}/${route.id}-375-light.png`, fullPage: true });

  // Part 10's open issue: the reply composer must open in a sheet on a phone, not inline.
  if (route.id === "thread") {
    await page
      .getByRole("button", { name: /^Reply$/ })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "Reply" })).toBeVisible();
    await page.getByRole("dialog", { name: "Reply" }).locator("button.absolute.right-4").click();
    await expect(page.getByRole("dialog", { name: "Reply" })).toBeHidden({ timeout: 10_000 });
  }

  if (route.app) {
    await page.setViewportSize({ width: 1440, height: 900 });
    // The appearance setting is "system" by default for the seeded users, so the real media query
    // path (AppearanceSync follows it) is what switches the app to night.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await settle(page);
    await expectNoSeriousAxeViolations(page);
    await page.screenshot({ path: `${OUT}/${route.id}-1440-dark.png`, fullPage: true });
  }
}

test.describe("design gallery: public screens", () => {
  for (const route of SELECTED.filter((entry) => !entry.app)) {
    test(route.id, async ({ page }) => {
      await runScreen(page, route);
    });
  }
});

test.describe("design gallery: app screens", () => {
  test.use({ storageState: ".e2e/admin.json" });
  for (const route of SELECTED.filter((entry) => entry.app)) {
    test(route.id, async ({ page }) => {
      await runScreen(page, route);
    });
  }
});
