import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);

async function markDealWon(page: Page, dealId: string): Promise<void> {
  await page.goto(`/deals/${dealId}`);
  const reopen = page.getByRole("button", { name: "Reopen", exact: true });
  const won = page.getByRole("button", { name: "Won", exact: true });
  // Wait for the header's status control before deciding (the page streams in).
  await expect(won.or(reopen).first()).toBeVisible({ timeout: 20_000 });
  if (await reopen.isVisible()) {
    await reopen.click();
    await expect(won).toBeVisible({ timeout: 20_000 });
  }
  // The status controls hydrate client-side, so retry the click until the header reacts. Winning
  // may open the optional follow-up composer first; dismiss it, then wait for Reopen.
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!(await reopen.isVisible()) && !(await dialog.isVisible().catch(() => false))) {
      await won.click({ timeout: 2_000 });
    }
    await expect(reopen.or(dialog.first())).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 40_000 });
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  }
  await expect(reopen).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
}

async function dragFirstCardToSecondColumn(page: Page): Promise<void> {
  const card = page.getByTestId("task-card").first();
  const column = page.getByTestId("phase-column").nth(1);
  const from = await card.boundingBox();
  const to = await column.boundingBox();
  if (from === null || to === null) throw new Error("board geometry unavailable");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit's PointerSensor needs movement past its 8px activation distance.
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

test("projects, API, recycle bin, export, audit log and backups", async ({ page, request }) => {
  const { dealId, personId, personName } = fixtures();
  expect(personId).not.toBeNull();

  // 1. Mark the demo deal won, then create a project from its sidebar.
  await markDealWon(page, dealId);
  await page.goto(`/deals/${dealId}`);
  const section = page.getByTestId("deal-projects-section");
  await expect(section).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("deal-create-project").click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("project-board")).toBeVisible({ timeout: 20_000 });

  // A fresh project has no tasks: add one to Kickoff, then drag it to Delivery.
  await page.getByTestId("task-add").first().click();
  await page.getByLabel("Title", { exact: true }).fill("E2E first task");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByTestId("task-card")).toHaveCount(1, { timeout: 20_000 });
  await dragFirstCardToSecondColumn(page);
  await page.reload();
  await expect(page.getByTestId("phase-column").nth(1).getByTestId("task-card")).toHaveCount(1, {
    timeout: 30_000,
  });
  await shot(page, "p8-project-board");

  await page.goto("/projects");
  await expect(page.getByTestId("projects-table")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p8-projects-list");

  // 2. Create a read-write API token and use it without cookies.
  await page.goto("/settings/api");
  await page.getByTestId("api-token-new").click();
  await page.getByLabel("Name", { exact: true }).fill("E2E token");
  await page.getByLabel("Scope", { exact: true }).click();
  await page.getByRole("option", { name: "Read and write", exact: true }).click();
  await page.getByRole("button", { name: "Create token", exact: true }).click();
  const secret = await page.getByTestId("api-token-secret").textContent();
  expect(secret).toMatch(/^dfk_/);
  await shot(page, "p8-api-tokens");
  await page.getByRole("button", { name: "Close", exact: true }).first().click();

  const headers = { Authorization: `Bearer ${secret ?? ""}` };
  const list = await request.get("/api/v1/deals?limit=2", { headers });
  expect(list.status()).toBe(200);
  const listed = (await list.json()) as { data: unknown[]; nextCursor?: string };
  expect(Array.isArray(listed.data)).toBe(true);
  expect(typeof listed.nextCursor).toBe("string");

  const note = await request.post("/api/v1/notes", {
    headers,
    data: { dealId, body: "Created through the REST API" },
  });
  expect(note.status()).toBe(201);

  await page.goto("/settings/api?tab=docs");
  await expect(page.getByTestId("api-docs")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p8-api-docs");

  // 3. Delete a person through the API, restore it in the recycle bin, then open the page.
  const removed = await request.delete(`/api/v1/persons/${personId ?? ""}`, { headers });
  expect(removed.status()).toBe(200);
  await page.goto("/settings/recycle-bin");
  await expect(page.getByTestId("recycle-table")).toBeVisible({ timeout: 20_000 });
  const row = page.locator(`[data-testid="recycle-row"][data-id="${personId ?? ""}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await shot(page, "p8-recycle-bin");
  await row.getByTestId("recycle-restore").click();
  // The restore is a server action; navigating before it lands aborts the request and the record
  // still looks deleted. Wait for the restored row to leave the bin first.
  await expect(row).toHaveCount(0, { timeout: 20_000 });
  await page.goto(`/contacts/people/${personId ?? ""}`);
  // The page name moved to the top bar, so target the person heading by name instead of `h1`
  // (which is now the top-bar title plus the content heading).
  await expect(page.getByRole("heading", { level: 1, name: personName })).toBeVisible({
    timeout: 20_000,
  });

  // 4. Export the deals list: the first line carries the table headers.
  await page.goto("/pipeline");
  await page.waitForURL(/\/pipeline\/[0-9a-f-]+$/, { timeout: 30_000 });
  await page.getByRole("link", { name: "List view" }).click();
  await expect(page.getByTestId("export-csv")).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-csv").click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const firstLine = readFileSync(path ?? "", "utf8").split("\r\n")[0] ?? "";
  expect(firstLine).toContain("Title");
  expect(firstLine).toContain("Value");

  // 5. The audit log shows at least one event for the admin.
  await page.goto("/settings/audit-log");
  await expect(page.getByTestId("audit-table")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("audit-row").first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "p8-audit-log");

  // 6. Backups: the page and restore panel. The real dump round trip is proven by the smoke test.
  await page.goto("/settings/backups");
  await expect(page.getByTestId("backup-now")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("How to restore")).toBeVisible();
  await shot(page, "p8-backups");
});
