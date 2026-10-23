import { expect, type Locator, type Page, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(240_000);

async function selectEuro(page: Page): Promise<void> {
  // Common currencies lead the add-rate picker, so the first option is EUR (USD is
  // the base and excluded). Enter selects the focused first option.
  const trigger = page.getByRole("combobox", { name: "Currency", exact: true });
  await trigger.click();
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("EUR");
}

async function dragCardTo(page: Page, card: Locator, target: Locator): Promise<void> {
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error("drag source or target has no box");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit's PointerSensor needs movement past its 8px activation distance.
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, {
    steps: 3,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("currencies, products, deal lines, board totals and the forecast drag", async ({ page }) => {
  const { salesDealId, salesDealTitle } = fixtures();
  expect(salesDealId).not.toBeNull();
  const dealId = salesDealId ?? "";
  const dealTitle = salesDealTitle ?? "Demo sales playground";

  // 1. The manual EUR rate (the demo seed writes 1.08 against the USD base).
  await page.goto("/settings/currencies");
  await expect(page.getByTestId("currencies-base-select")).toBeVisible();
  await selectEuro(page);
  // A value distinct from the seed's 1.08 proves the Save actually wrote, not just that
  // the seeded row exists.
  await page.getByTestId("currency-rate-input").fill("1.09");
  await page.getByTestId("currency-rate-save").click();
  const eurRow = page.locator('[data-testid="currency-rate-row"][data-code="EUR"]');
  await expect(eurRow).toContainText("1.09");
  await shot(page, "p3-settings-currencies");

  // 2. A product with a 20% tax.
  await page.goto("/settings/products");
  await page.getByTestId("product-new").click();
  const dialog = page.getByTestId("product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill("Onboarding package");
  await dialog.getByLabel("Code", { exact: true }).fill("ONBOARD");
  await dialog.getByLabel("Price", { exact: true }).fill("1200.00");
  await dialog.getByLabel("Tax %", { exact: true }).fill("20");
  await shot(page, "p3-product-dialog");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("products-table")).toContainText("Onboarding package");
  await shot(page, "p3-settings-products");

  // 3. Add the product to the line-free USD deal, then 2 units at 10% discount.
  await page.goto(`/deals/${dealId}`);
  const section = page.getByTestId("deal-products-section");
  await expect(section).toBeAttached();
  await section.getByTestId("deal-product-add").getByRole("button").click();
  const search = page.getByPlaceholder(/^Search/);
  await expect(search).toBeVisible();
  await search.fill("Onboarding");
  const option = page.getByRole("option", { name: /Onboarding package/ });
  await expect(option).toBeVisible();
  await option.click();
  const row = section.getByTestId("deal-product-row").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByLabel("Qty Onboarding package").fill("2");
  await row.getByLabel("Qty Onboarding package").press("Enter");
  await expect(row.getByLabel("Disc % Onboarding package")).toBeEnabled();
  await row.getByLabel("Disc % Onboarding package").fill("10");
  await row.getByLabel("Disc % Onboarding package").press("Enter");

  await expect(page.getByTestId("deal-products-net")).toContainText("2,160.00", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("deal-products-tax")).toContainText("432.00");
  await expect(page.getByTestId("deal-products-gross")).toContainText("2,592.00");
  await expect(page.getByText("Calculated from products")).toBeVisible();
  await expect(page.getByText("$2,160.00").first()).toBeVisible();
  await shot(page, "p3-deal-products");

  // 4. The board shows converted and weighted totals plus the JPY exclusion.
  await page.goto("/pipeline");
  await expect(page.getByTestId("board-column-total").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("board-column-weighted").first()).toBeVisible();
  await expect(page.getByTestId("totals-excluded").first()).toBeVisible();
  await shot(page, "p3-board-totals");

  // 5. The forecast card is in a month and can be dragged to another one.
  await page.goto("/forecast");
  await expect(page.getByTestId("forecast-board")).toBeVisible({ timeout: 30_000 });
  const card = page.locator('[data-testid="forecast-card"]', { hasText: dealTitle }).first();
  await expect(card).toBeVisible();
  const column = card.locator("xpath=ancestor::section[@data-testid='forecast-column']");
  const sourceMonth = await column.getAttribute("data-month");
  const columns = page.getByTestId("forecast-column");
  const count = await columns.count();
  const sourceIndex = await columns.evaluateAll(
    (nodes, month) => nodes.findIndex((node) => node.getAttribute("data-month") === month),
    sourceMonth,
  );
  const targetIndex = sourceIndex < count - 1 ? sourceIndex + 1 : sourceIndex - 1;
  const target = columns.nth(targetIndex);
  const targetMonth = await target.getAttribute("data-month");
  expect(targetMonth).not.toBeNull();
  expect(targetMonth).not.toBe(sourceMonth);

  await dragCardTo(page, card, target);
  await expect(target.locator('[data-testid="forecast-card"]', { hasText: dealTitle })).toBeVisible(
    { timeout: 20_000 },
  );

  await page.reload();
  await expect(page.getByTestId("forecast-board")).toBeVisible({ timeout: 30_000 });
  const reloaded = page.locator(`[data-testid="forecast-column"][data-month="${targetMonth}"]`);
  await expect(
    reloaded.locator('[data-testid="forecast-card"]', { hasText: dealTitle }),
  ).toBeVisible({ timeout: 20_000 });
  await shot(page, "p3-forecast");
});
