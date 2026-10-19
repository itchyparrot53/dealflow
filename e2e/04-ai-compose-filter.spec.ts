import { expect, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });

test.describe("composer draft, filter and usage", () => {
  test("drafts an email with AI and fills a filter from plain English", async ({ page }) => {
    const { dealId } = fixtures();
    await page.goto(`/deals/${dealId}`);
    await page.locator('section[aria-label="compose"]').getByRole("tab", { name: "Email" }).click();

    await page.getByTestId("ai-draft-trigger").click();
    await page.getByLabel("What should the email say?").fill("Ask for a call next week");
    await page.getByRole("button", { name: "Draft" }).click();

    await expect(page.getByPlaceholder("Subject")).toHaveValue("FAKE subject");
    const body = page.locator('[contenteditable="true"]').first();
    await expect(body).toContainText("FAKE body: Ask for a call next week");
    await shot(page, "p1-composer-ai");
    // Close without sending.
    await page.getByRole("button", { name: "Discard" }).click();

    // Plain English to deal filter conditions.
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Filter", exact: true }).first().click();
    await page.getByRole("menuitem", { name: /Create new filter/ }).click();
    await page.getByLabel("Describe a filter").fill("big deals");
    await page.getByRole("button", { name: "Generate filter" }).click();
    await expect(page.getByTestId("ai-filter-explanation")).toContainText("FAKE");
    const firstField = page.getByRole("combobox", { name: "Condition 1 field" });
    await expect(firstField).toContainText("Value");
    await shot(page, "p1-filter-ai");
    await page.keyboard.press("Escape");

    // The AI calls above are logged and shown on the admin page.
    await page.goto("/settings/ai");
    await expect(page.getByTestId("ai-usage-used")).toContainText(/Used [1-9]/);
    await expect(page.getByTestId("ai-usage-feature-row").first()).toBeVisible();
    await shot(page, "p1-settings-ai");
  });
});
