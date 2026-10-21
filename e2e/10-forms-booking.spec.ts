import { type Browser, expect, type Page, test } from "@playwright/test";
import { latestMail, linkFrom, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);

async function adminPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: ".e2e/admin.json" });
  return context.newPage();
}

async function visitorPage(browser: Browser): Promise<Page> {
  // No storageState: a visitor has no session, like anyone opening the public link.
  const context = await browser.newContext();
  return context.newPage();
}

test("forms and booking pages: build, submit and cancel through the public pages", async ({
  page,
  browser,
}) => {
  // 1. Settings > Forms.
  await page.goto("/settings/forms");
  await expect(page.getByTestId("forms-table")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p6-forms-list");

  // 2. Create "Website enquiry", creating leads, and add a phone field.
  await page.getByTestId("form-new").click();
  await page.waitForURL(/\/settings\/forms\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("form-editor")).toBeVisible();
  await page.locator("#form-name").fill("Website enquiry");
  await page.getByTestId("form-field-add").click();
  await page.getByRole("option", { name: "Phone" }).click();
  await expect(page.locator('[data-testid="form-field-row"][data-key="phone"]')).toBeVisible();
  await page.getByTestId("form-save").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
  const publicLink = await page.getByTestId("form-public-link").inputValue();
  expect(publicLink).toContain("/f/");
  await shot(page, "p6-form-editor");

  // 3. Submit the form in a fresh context with no session.
  const visitor = await visitorPage(browser);
  await visitor.goto(publicLink);
  await expect(visitor.getByTestId("public-form")).toBeVisible({ timeout: 20_000 });
  // The fill-time floor is two seconds; wait past it before submitting.
  await visitor.waitForTimeout(2_500);
  await visitor
    .locator('[data-testid="public-form-field"][data-key="name"] input')
    .fill("Riley Chen");
  await visitor
    .locator('[data-testid="public-form-field"][data-key="email"] input')
    .fill("riley.chen@example.com");
  await visitor
    .locator('[data-testid="public-form-field"][data-key="organization"] input')
    .fill("Chen Studio");
  await visitor
    .locator('[data-testid="public-form-field"][data-key="message"] textarea')
    .fill("We need a simple CRM.");
  await shot(visitor, "p6-public-form");
  await visitor.getByTestId("public-form-submit").click();
  await expect(visitor.getByTestId("public-form-success")).toBeVisible({ timeout: 20_000 });
  await visitor.context().close();

  // 4. The lead exists and the owner was notified.
  await page.goto("/leads");
  await expect(page.getByText("Riley Chen via Website enquiry").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText(/New form submission/).first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");

  // 5. A booking page, open every day 09:00 to 17:00 in UTC with no notice period.
  await page.goto("/settings/booking");
  await expect(page.getByTestId("booking-pages-table")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("booking-page-new").click();
  await page.waitForURL(/\/settings\/booking\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("booking-editor")).toBeVisible();
  await page.locator("#booking-title").fill("Discovery call");
  for (const day of ["sat", "sun"]) {
    const row = page.locator(`[data-testid="availability-day"][data-day="${day}"]`);
    await row.getByTestId(`availability-toggle-${day}`).click();
  }
  await page.getByTestId("booking-notice-select").click();
  await page.getByRole("option", { name: "0 hours" }).click();
  await page.getByRole("button", { name: "Time zone" }).click();
  await page.getByPlaceholder("Search...").fill("UTC");
  await page.getByRole("option", { name: "UTC", exact: true }).click();
  await page.getByTestId("booking-save").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
  const bookingLink = await page.getByTestId("booking-public-link").inputValue();
  expect(bookingLink).toContain("/book/");
  await shot(page, "p6-booking-editor");
  await page.goto("/settings/booking");
  await expect(page.getByTestId("booking-pages-table")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p6-booking-pages");

  // 6. Book the first available slot as a visitor.
  const booker = await visitorPage(browser);
  await booker.goto(bookingLink);
  await expect(booker.getByTestId("public-booking")).toBeVisible({ timeout: 20_000 });
  let found = false;
  for (let i = 0; i < 14 && !found; i += 1) {
    await booker.getByTestId("booking-day").nth(i).click();
    found = await booker
      .getByTestId("booking-slot")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!found) await booker.waitForTimeout(500);
  }
  expect(found).toBe(true);
  await shot(booker, "p6-public-booking");
  await booker.getByTestId("booking-slot").first().click();
  await booker.getByTestId("booking-name").fill("Sam Ortiz");
  await booker.getByTestId("booking-email").fill("sam.ortiz@example.com");
  await booker.getByTestId("booking-submit").click();
  await expect(booker.getByTestId("booking-confirmed")).toBeVisible({ timeout: 30_000 });
  await shot(booker, "p6-booking-confirmed");

  // 7. The host has the activity; the confirmation email carries the cancel link.
  const host = await adminPage(browser);
  await host.goto("/activities/list");
  // The list defaults to today's open activities; a booking later in the week must still be found.
  await host.getByRole("button", { name: "To-do", exact: true }).click();
  await expect(host.getByText("Discovery call with Sam Ortiz").first()).toBeVisible({
    timeout: 30_000,
  });
  const mail = latestMail("sam.ortiz@example.com");
  expect(mail).not.toBeNull();
  if (mail === null) throw new Error("no confirmation email captured");
  const cancelLink = linkFrom(mail);
  expect(cancelLink).toContain("/book/cancel/");

  // 8. Cancel through the emailed link, then the activity is gone.
  await booker.context().close();
  const canceller = await visitorPage(browser);
  await canceller.goto(cancelLink);
  await expect(canceller.getByTestId("booking-cancel-confirm")).toBeVisible({ timeout: 20_000 });
  await canceller.getByTestId("booking-cancel-confirm").click();
  await expect(canceller.getByTestId("booking-cancelled")).toBeVisible({ timeout: 20_000 });
  await canceller.context().close();
  await host.reload();
  await expect(host.getByText("Discovery call with Sam Ortiz")).toHaveCount(0, { timeout: 30_000 });
  await host.context().close();
});
