import { expect, type Page, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

// Part 9 productivity surfaces (Task 4.1). One admin session drives the real screens: recurrence,
// call logging, the URL-backed activities list with bulk actions, duplicates, the stage-move undo
// toast, the palette and the shortcut sequences/help sheet. Screenshots: p9-recurrence,
// p9-log-call, p9-activities-list, p9-duplicates, p9-undo-toast, p9-palette, p9-shortcut-help.

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);

async function waitForList(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "+ Activity", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

test("recurrence, calls, activities list, duplicates, undo, palette and shortcuts", async ({
  page,
}) => {
  const { dealId } = fixtures();

  // 1. Recurrence: create a weekly activity repeating on two weekdays. Clicking an empty hour
  // lane in the week calendar opens the dialog prefilled with that date and time, which is
  // deterministic (no date-picker navigation).
  await page.goto("/activities/calendar?view=week");
  await page
    .getByRole("button", { name: /^Add activity on / })
    .first()
    .click({ timeout: 30_000 });
  await page.getByLabel("Subject", { exact: true }).fill("P9 weekly standup");
  await page.getByRole("checkbox", { name: "Repeat this activity", exact: true }).click();
  await page.getByRole("checkbox", { name: "Mon", exact: true }).click();
  await page.getByRole("checkbox", { name: "Thu", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.goto("/activities/list");
  await waitForList(page);
  await page.getByRole("button", { name: "To-do", exact: true }).click();
  await expect(page.getByText("P9 weekly standup")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p9-recurrence");

  // Completing the occurrence creates the next one (the done row leaves the open filter).
  await page.getByRole("checkbox", { name: "Complete P9 weekly standup", exact: true }).click();
  await expect(page.getByText("P9 weekly standup")).toBeVisible({ timeout: 20_000 });

  // 2. Calls: log an outbound "No answer" call from the deal composer and see the chip.
  await page.goto(`/deals/${dealId}`);
  await page.getByTestId("log-call").click({ timeout: 30_000 });
  await page.getByRole("radio", { name: "No answer", exact: true }).click();
  await page.getByTestId("call-save").click();
  await expect(page.getByTestId("call-outcome-chip").first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "p9-log-call");

  // 3. Activities list: the type filter persists through a reload; two rows bulk-complete.
  await page.goto("/activities/list");
  await waitForList(page);
  await page.getByRole("button", { name: "To-do", exact: true }).click();
  await expect(page.getByRole("button", { name: "To-do", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Call", exact: true }).first().click();
  await expect(page).toHaveURL(/typeKey=call/);
  await page.reload();
  await waitForList(page);
  await expect(page.getByRole("button", { name: "Call", exact: true }).first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Owner", exact: true }).click();
  await page.getByRole("option", { name: "All owners", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /^Select Outbound call: No answer/ })
    .first()
    .click();
  await page
    .getByRole("checkbox", { name: /^Select Outbound call: Connected/ })
    .first()
    .click();
  await expect(page.getByTestId("activities-bulk-bar")).toBeVisible();
  await shot(page, "p9-activities-list");
  await page.getByTestId("bulk-mark-done").click();
  await expect(page.getByTestId("activities-bulk-bar")).toHaveCount(0, { timeout: 20_000 });

  // 4. Duplicates: the seeded pairs render; one dismissal removes a card.
  await page.goto("/contacts/duplicates");
  await expect(page.getByTestId("duplicate-pair").first()).toBeVisible({ timeout: 20_000 });
  const pairsBefore = await page.getByTestId("duplicate-pair").count();
  await shot(page, "p9-duplicates");
  await page.getByTestId("duplicate-dismiss").first().click();
  await expect(page.getByTestId("duplicate-pair")).toHaveCount(pairsBefore - 1, {
    timeout: 20_000,
  });

  // 5. Undo: drag a deal to the next stage, then undo from the toast.
  await page.goto("/pipeline");
  const cards = page.getByTestId("deal-card");
  const boardVisible = await expect(cards.first())
    .toBeVisible({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!boardVisible) {
    await page.getByLabel("Board view").click();
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  }
  const columns = page.getByTestId("board-column");
  const firstCount = await columns.nth(0).getByTestId("deal-card").count();
  const from = await cards.first().boundingBox();
  const to = await columns.nth(1).boundingBox();
  if (from === null || to === null) throw new Error("board geometry unavailable");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText(/Moved to /)).toBeVisible({ timeout: 20_000 });
  await shot(page, "p9-undo-toast");
  await page.getByTestId("toast-undo").click();
  // The undo write must land before the reload, otherwise the reload can abort it.
  await expect(columns.nth(0).getByTestId("deal-card")).toHaveCount(firstCount, {
    timeout: 20_000,
  });
  await page.reload();
  await expect(columns.nth(0).getByTestId("deal-card")).toHaveCount(firstCount, {
    timeout: 30_000,
  });

  // 6. Palette: Ctrl/Cmd+K, type "new project", see the command.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByLabel("Search", { exact: true }).fill("new project");
  await expect(page.locator('[data-command-id="create.project"]')).toBeVisible({
    timeout: 20_000,
  });
  await shot(page, "p9-palette");
  await page.keyboard.press("Escape");

  // 7. Shortcuts: g then j navigates to projects; ? opens the help sheet.
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Search", { exact: true })).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(400);
  // The palette's input keeps focus after closing; sequences are ignored while typing.
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await page.keyboard.press("g");
  await page.keyboard.press("j");
  await expect(page).toHaveURL(/\/projects$/, { timeout: 20_000 });
  await page.keyboard.press("?");
  await expect(page.getByTestId("shortcut-help")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p9-shortcut-help");
});
