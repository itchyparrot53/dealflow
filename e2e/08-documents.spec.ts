import { expect, type Page, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);

const APP_PASSWORD = "fake-app-password-1";

// The admin must have a connected mailbox to send from. The mail spec runs earlier and
// leaves an IMAP mailbox, but this spec also runs standalone, so it connects the fake
// IMAP account itself when the page shows the connect form (or a Gmail account).
async function ensureMailbox(page: Page, adminEmail: string): Promise<void> {
  await page.goto("/settings/email-sync");
  const form = page.getByTestId("connect-mailbox-form");
  const disconnect = page.getByRole("button", { name: "Disconnect" });
  // The seed ships a Gmail account and the mail spec may have connected IMAP: either way,
  // disconnect so this spec owns the (fake IMAP) connection it sends through.
  if (await disconnect.isVisible().catch(() => false)) await disconnect.click();
  await expect(form).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("App password").fill(APP_PASSWORD);
  await page.getByRole("button", { name: "Test and connect" }).click();
  await expect(page.getByTestId("mailbox-status")).toHaveAttribute("data-status", "connected", {
    timeout: 30_000,
  });
}

test("documents: settings, quote, public accept, invoice paid and the list", async ({
  page,
  browser,
}) => {
  const { documentsDealId, documentsDealTitle, adminEmail, personEmail } = fixtures();
  expect(documentsDealId).not.toBeNull();
  const dealId = documentsDealId ?? "";
  const dealTitle = documentsDealTitle ?? "Demo deal";

  // 1. Settings > Documents: the company block the quote prints.
  await page.goto("/settings/documents");
  await expect(page.getByTestId("documents-settings-form")).toBeVisible();
  await page.getByLabel("Company name").fill("Northwind Advisory");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await shot(page, "p4-settings-documents");

  // 2. A mailbox to send from.
  await ensureMailbox(page, adminEmail);

  // 3. Deal > Documents: create a quote from the deal's product lines.
  await page.goto(`/deals/${dealId}`);
  const section = page.getByTestId("deal-documents-section");
  await expect(section).toBeAttached();
  // The action button is server-rendered; retry the click until the client handler navigates.
  await expect(async () => {
    if (!/\/documents\/[0-9a-f-]+$/.test(page.url())) {
      await section.getByTestId("deal-new-quote").click({ timeout: 2_000 });
    }
    await page.waitForURL(/\/documents\/[0-9a-f-]+$/, { timeout: 3_000 });
  }).toPass({ timeout: 45_000 });
  const documentId = page.url().split("/").pop() ?? "";
  expect(documentId).not.toBe("");
  await expect(page.getByTestId("document-status")).toContainText("Draft");
  await expect(page.getByTestId("document-number")).toContainText("Draft");

  // 4. Back on the deal, the section lists the new draft; open it from there.
  await page.goto(`/deals/${dealId}`);
  const dealSection = page.getByTestId("deal-documents-section");
  await expect(dealSection.getByTestId("document-row").first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "p4-deal-documents");
  await dealSection.getByTestId("document-row").first().click();
  await page.waitForURL(/\/documents\/[0-9a-f-]+$/, { timeout: 30_000 });

  // 5. The editor shows the snapped lines and lets the draft be edited.
  await expect(page.getByTestId("document-editor")).toBeVisible();
  const emailField = page.locator("#document-customer-email");
  if ((await emailField.inputValue()) === "") {
    await emailField.fill(personEmail);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  }
  await shot(page, "p4-document-editor");

  // 5. Send: the draft is issued, then mailed through the fake IMAP mailbox.
  await page.getByTestId("document-send").click();
  const sendDialog = page.getByTestId("document-send-dialog");
  await expect(sendDialog).toBeVisible();
  const toField = sendDialog.locator("#document-send-to");
  if ((await toField.inputValue()) === "") await toField.fill(personEmail);
  await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sendDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("document-status")).toContainText("Sent");
  await expect(page.getByTestId("document-number")).toContainText(/Q-\d{4}-\d{4,}/);

  // 6. The public link, opened in a context with no session.
  const publicUrl = await page.getByTestId("document-copy-link").getAttribute("data-public-url");
  expect(publicUrl).not.toBeNull();
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(publicUrl ?? "");
  await expect(publicPage.getByTestId("public-document")).toBeVisible();
  await expect(publicPage.getByTestId("public-status")).toContainText("viewed");
  await shot(publicPage, "p4-public-quote");

  await publicPage.getByTestId("public-accept-name").fill("Jamie Rivera");
  await publicPage.getByTestId("public-accept-checkbox").click();
  await expect(publicPage.getByTestId("public-accept")).toBeEnabled();
  await publicPage.getByTestId("public-accept").click();
  await expect(publicPage.getByText(/Accepted by Jamie Rivera/)).toBeVisible({ timeout: 20_000 });
  await shot(publicPage, "p4-public-quote-accepted");
  await publicContext.close();

  // 7. Back in the app: accepted, and the owner was notified.
  await page.reload();
  await expect(page.getByTestId("document-status")).toContainText("Accepted", {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText(/Jamie Rivera accepted/)).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");

  // 8. Create an invoice from the accepted quote, mark it sent and pay it in full.
  await page.getByTestId("document-create-invoice").click();
  await page.waitForURL(/\/documents\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("document-number")).toContainText("Draft");
  await page.getByTestId("document-mark-sent").click();
  await expect(page.getByTestId("document-status")).toContainText("Sent", { timeout: 20_000 });
  await expect(page.getByTestId("document-number")).toContainText(/INV-\d{4}-\d{4,}/);
  await page.getByTestId("document-record-payment").click();
  const paymentDialog = page.getByTestId("document-payment-dialog");
  await expect(paymentDialog).toBeVisible();
  await paymentDialog.getByRole("button", { name: "Record", exact: true }).click();
  await expect(paymentDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("document-status")).toContainText("Paid", { timeout: 20_000 });
  await expect(page.getByTestId("document-outstanding")).toContainText("0.00");
  await shot(page, "p4-invoice-paid");

  // 9. The document list.
  await page.goto("/documents");
  await expect(page.getByTestId("documents-list")).toBeVisible();
  await page.getByRole("tab", { name: "Invoices" }).click();
  await expect(page.getByTestId("documents-outstanding-total")).toBeVisible();
  await shot(page, "p4-documents-list");

  // The seeded deal title is only used to keep the fixture honest.
  expect(dealTitle.length).toBeGreaterThan(0);
});
