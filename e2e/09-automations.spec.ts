import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, type Page, test } from "@playwright/test";
import { verifySignature } from "../src/features/webhooks/signature";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);

interface Received {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

// Reopen a deal if an earlier spec closed it, then mark it won through the UI.
async function markDealWon(page: Page, dealId: string): Promise<void> {
  await page.goto(`/deals/${dealId}`);
  const reopen = page.getByRole("button", { name: "Reopen", exact: true });
  if (await reopen.isVisible().catch(() => false)) {
    await reopen.click();
    await expect(reopen).toBeHidden({ timeout: 20_000 });
  }
  await page.getByRole("button", { name: "Won", exact: true }).click();
  // A follow-up activity prompt may open after the win; the deal is already won server-side.
  await page.keyboard.press("Escape");
}

async function openRunLog(page: Page, editorUrl: string): Promise<void> {
  await page.goto(editorUrl);
  await page.getByTestId("automation-runs-tab").click();
}

test("automations and webhooks: describe, template, run log and a signed delivery", async ({
  page,
}) => {
  const { dealId, documentsDealId, salesDealId } = fixtures();
  const secondDealId = documentsDealId ?? salesDealId ?? "";
  expect(secondDealId).not.toBe("");

  // 1. Settings > Automations.
  await page.goto("/settings/automations");
  await expect(page.getByTestId("automations-table")).toBeVisible({ timeout: 20_000 });
  await shot(page, "p5-automations-list");

  // 2. Describe it: draft one in a sentence, then leave without saving the draft.
  await page.getByTestId("automation-describe").click();
  const describe = page.getByTestId("automation-describe-dialog");
  await expect(describe).toBeVisible();
  await page
    .getByTestId("automation-describe-input")
    .fill("When a deal is won, create a follow-up call tomorrow");
  await shot(page, "p5-automation-describe");
  await page.getByTestId("automation-describe-submit").click();
  await page.waitForURL(/\/settings\/automations\/[0-9a-f-]+\?drafted=1$/, { timeout: 30_000 });
  await page.goto("/settings/automations");

  // 3. Start from template 1 (onboarding call on win), enable it and save.
  await page.getByTestId("automation-templates").click();
  await expect(page.getByTestId("automation-templates-dialog")).toBeVisible();
  await page.getByTestId("automation-template-card").first().click();
  await page.waitForURL(/\/settings\/automations\/[0-9a-f-]+$/, { timeout: 30_000 });
  const automationUrl = page.url();
  await expect(page.getByTestId("automation-editor")).toBeVisible();
  await page.getByTestId("automation-enabled").click();
  await page.getByTestId("automation-save").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
  await shot(page, "p5-automation-editor");

  // 4. Mark a seeded open deal won and wait for the run to succeed.
  await markDealWon(page, dealId);
  let succeeded = false;
  for (let attempt = 0; attempt < 30 && !succeeded; attempt += 1) {
    await openRunLog(page, automationUrl);
    try {
      // The runs query resolves after the tab mounts, so wait rather than sampling once.
      await expect(
        page.locator('[data-testid="automation-run-row"][data-status="succeeded"]').first(),
      ).toBeVisible({ timeout: 5000 });
      succeeded = true;
    } catch {
      succeeded = false;
    }
    if (!succeeded) await page.waitForTimeout(1000);
  }
  expect(succeeded).toBe(true);
  await shot(page, "p5-automation-runs");

  // 5. The activity the automation created is on the deal.
  await page.goto(`/deals/${dealId}`);
  await expect(page.getByText(/Onboarding call with/).first()).toBeVisible({ timeout: 20_000 });

  // 6. A real receiver on loopback, then a subscription for deal.won.
  const received: Received[] = [];
  const waiters: ((value: Received) => void)[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      const entry = { headers: request.headers, body };
      received.push(entry);
      waiters.shift()?.(entry);
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const hookUrl = `http://127.0.0.1:${port}/hook`;
  const nextRequest = (): Promise<Received> =>
    received.length > 0
      ? Promise.resolve(received[0] as Received)
      : new Promise<Received>((resolve) => waiters.push(resolve));

  try {
    await page.goto("/settings/webhooks");
    await page.getByTestId("webhook-new").click();
    const dialog = page.getByTestId("webhook-dialog");
    await expect(dialog).toBeVisible();
    await page.locator("#webhook-name").fill("E2E receiver");
    await page.getByTestId("webhook-url").fill(hookUrl);
    // deal.won is the dialog's default event.
    await expect(page.getByRole("checkbox", { name: "deal.won" })).toBeChecked();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const secretField = page.getByTestId("webhook-secret");
    await expect(secretField).toBeVisible({ timeout: 20_000 });
    const secret = await secretField.inputValue();
    expect(secret.startsWith("whsec_")).toBe(true);
    await shot(page, "p5-webhooks");

    // 7. Winning a second deal delivers a signed request to the receiver.
    const pending = nextRequest();
    await markDealWon(page, secondDealId);
    const request = await Promise.race([
      pending,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("no webhook request within 45s")), 45_000),
      ),
    ]);
    const header = request.headers["x-dealflow-signature"];
    expect(typeof header).toBe("string");
    expect(
      verifySignature(secret, header as string, request.body, Math.floor(Date.now() / 1000)),
    ).toBe(true);

    // 8. The delivery log records the attempt.
    await page.goto("/settings/webhooks");
    const row = page.getByTestId("webhook-row").first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    let rowVisible = false;
    for (let attempt = 0; attempt < 20 && !rowVisible; attempt += 1) {
      await row.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Delivery log" }).click();
      rowVisible = await page
        .getByTestId("webhook-delivery-row")
        .first()
        .isVisible()
        .catch(() => false);
      if (!rowVisible) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
      }
    }
    expect(rowVisible).toBe(true);
    await expect(page.getByTestId("webhook-deliveries")).toBeVisible();
    await expect(
      page.getByTestId("webhook-deliveries").getByText("Delivery log", { exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, "p5-webhook-deliveries");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
