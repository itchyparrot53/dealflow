import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);

async function choose(page: Page, testId: string, option: string): Promise<void> {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("insights: dashboards, report builder, explain, CSV and bulk AI scoring", async ({ page }) => {
  // 1. Insights home: the default dashboard is listed and opens with six widgets.
  await page.goto("/insights");
  await expect(page.getByTestId("insights-home")).toBeVisible({ timeout: 20_000 });
  const salesOverview = page.getByTestId("dashboard-row").filter({ hasText: "Sales overview" });
  await expect(salesOverview).toBeVisible({ timeout: 20_000 });
  await shot(page, "p7-insights-home");

  await salesOverview.click();
  await page.waitForURL(/\/insights\/dashboards\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("dashboard-view")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("dashboard-widget")).toHaveCount(6, { timeout: 60_000 });
  await shot(page, "p7-dashboard");

  // 2. Build a report: deals, sum of value, won month, last 12 months, bar.
  await page.goto("/insights");
  await page.getByTestId("insights-tab-reports").click();
  await page.getByTestId("report-new").click();
  await page.waitForURL(/\/insights\/reports\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("report-builder")).toBeVisible();

  await choose(page, "report-measure", "Sum of value");
  await choose(page, "report-group-by", "won");
  await page.getByLabel("Date field").click();
  await page.getByRole("option", { name: "won", exact: true }).click();
  await choose(page, "report-date-preset", "last 12 months");

  const chart = page.getByTestId("report-chart");
  await expect(chart).toHaveAttribute("data-chart", "bar", { timeout: 30_000 });
  await expect(page.getByTestId("report-total")).toBeVisible();
  await shot(page, "p7-report-builder");

  // 3. Segment by owner, switch to a stacked bar and save.
  await choose(page, "report-segment-by", "owner");
  await page.getByTestId("report-chart-type-stacked_bar").click();
  await expect(chart).toHaveAttribute("data-chart", "stacked_bar", { timeout: 30_000 });
  await page.getByTestId("report-save").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
  await shot(page, "p7-report-segmented");

  // 4. Explain: AI_FAKE returns three deterministic insights.
  await expect(page.getByTestId("report-explain")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("report-explain").click();
  await expect(page.getByTestId("explain-insights")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("explain-item")).toHaveCount(3, { timeout: 30_000 });
  await shot(page, "p7-explain");
  await page.keyboard.press("Escape");

  // 5. Export CSV: a download whose first line is the header.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("report-export-csv").click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).not.toBeNull();
  const csv = readFileSync(file ?? "", "utf8");
  expect(csv.split("\r\n")[0]).toBe('"Group","Segment","Count","Value (USD)"');

  // 6. Bulk score two deals from the pipeline list, waiting for the completion notification.
  await page.goto("/pipeline");
  await expect(page.locator("[data-deal-id]").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "List view" }).click();
  await expect(page.getByRole("checkbox", { name: /^Select / }).first()).toBeVisible({
    timeout: 30_000,
  });
  // The first checkbox is "Select all deals"; the rows follow it.
  const boxes = page.getByRole("checkbox", { name: /^Select / });
  await boxes.nth(1).click();
  await boxes.nth(2).click();
  await page.getByTestId("bulk-score").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Score with AI", exact: true })
    .click();
  await expect(page.getByTestId("bulk-score-note")).toBeVisible({ timeout: 20_000 });

  let notified = false;
  for (let attempt = 0; attempt < 20 && !notified; attempt += 1) {
    await page.reload();
    await page.getByRole("button", { name: "Notifications" }).click();
    notified = await page
      .getByText(/Scored 2 of 2 deals/)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!notified) await page.waitForTimeout(1500);
  }
  expect(notified).toBe(true);
  await page.keyboard.press("Escape");

  // 7. The board shows the new score badge on the scored deals.
  await page.goto("/pipeline");
  await expect(page.getByTestId("deal-score-badge").first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "p7-board-scores");
});
