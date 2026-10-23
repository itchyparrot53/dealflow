import { expect, type Page, test } from "@playwright/test";
import {
  type CapturedMail,
  fakeFolder,
  fixtures,
  latestMail,
  linkFrom,
  readFakeMail,
  shot,
} from "./helpers";

// Part 13 proof: every outbound email goes through the one renderer, its copy is editable, and
// customer mail carries the company layout. Mail is read from the capture mailer (system mail)
// and the fake IMAP Sent folder (mailbox mail).

const APP_PASSWORD = "fake-app-password-1";

function decodedParts(raw: string): string {
  return [...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/g)]
    .map((match) => Buffer.from((match[1] ?? "").replace(/\s+/g, ""), "base64").toString("utf8"))
    .join("\n");
}

async function waitForSent(adminEmail: string, needle: string): Promise<string> {
  let found = "";
  await expect(async () => {
    const files = [...fakeFolder(adminEmail, "Sent")].reverse();
    for (const file of files) {
      const raw = readFakeMail(adminEmail, "Sent", file);
      if (decodedParts(raw).includes(needle)) {
        found = raw;
        return;
      }
    }
    throw new Error(`no sent message containing ${needle} yet`);
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });
  return found;
}

async function ensureMailbox(page: Page, adminEmail: string): Promise<void> {
  await page.goto("/settings/email-sync");
  const form = page.getByTestId("connect-mailbox-form");
  const disconnect = page.getByRole("button", { name: "Disconnect" });
  if (await disconnect.isVisible().catch(() => false)) await disconnect.click();
  await expect(form).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("App password").fill(APP_PASSWORD);
  await page.getByRole("button", { name: "Test and connect" }).click();
  await expect(page.getByTestId("mailbox-status")).toHaveAttribute("data-status", "connected", {
    timeout: 30_000,
  });
}

async function composeNew(
  page: Page,
  dealId: string,
  subject: string,
  body: string,
): Promise<void> {
  await page.goto(`/deals/${dealId}`);
  const composer = page.locator('section[aria-label="compose"]');
  await composer.getByRole("tab", { name: "Email" }).click();
  await page.getByPlaceholder("Subject").fill(subject);
  await page.locator('[contenteditable="true"]').first().fill(body);
  await composer.getByRole("button", { name: "Send", exact: true }).click();
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign-in email uses the layout", async ({ page }) => {
    const { adminEmail } = fixtures();
    await page.goto("/login");
    await page.getByRole("tab", { name: "Email link" }).click();
    await page.locator("#link-email").fill(adminEmail);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByTestId("login-sent")).toBeVisible();

    await expect
      .poll(() => latestMail(adminEmail)?.subject, { timeout: 20_000 })
      .toBe("Your Dealflow sign-in link");
    const mail = latestMail(adminEmail);
    expect(mail).not.toBeNull();
    if (mail === null) return;
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).toContain('data-df-layout="product-branded"');
    expect(mail.html).toContain('src="http://localhost:3210/brand/email-logo@2x.png"');
    expect(mail.text).toContain("http://localhost:3210/login/magic?token=");

    const link = linkFrom(mail);
    await page.goto(link);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/pipeline/);
  });
});

test.describe("admin", () => {
  test.use({ storageState: ".e2e/admin.json" });
  test.setTimeout(300_000);

  test("admin edits the invite template", async ({ page, browser }) => {
    const { adminEmail } = fixtures();
    const stamp = Date.now();
    const firstEmail = `e2e-email-${stamp}@example.com`;
    const secondEmail = `e2e-email-reset-${stamp}@example.com`;

    await page.goto("/settings/email-design");
    await page.getByRole("tab", { name: "Templates" }).click();
    const inviteRow = page.getByRole("row", { name: /Invite/ });
    await inviteRow.getByRole("button", { name: "Edit" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const editorBody = page.locator('[contenteditable="true"]').last();
    await editorBody.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(" Welcome aboard", { delay: 10 });
    await expect(editorBody).toContainText("Welcome aboard");
    await sheet.getByRole("button", { name: "Save template" }).click();
    await expect(sheet).toBeHidden({ timeout: 20_000 });

    async function invite(email: string): Promise<CapturedMail> {
      await page.goto("/settings/users");
      const form = page.locator("form[novalidate]");
      await form.getByLabel("Email", { exact: true }).fill(email);
      await form.getByLabel("Name", { exact: true }).fill("E2E Email Invitee");
      await form.getByRole("button", { name: "Invite", exact: true }).click();
      await expect(page.getByTestId("invite-result")).toBeVisible();
      await expect.poll(() => latestMail(email) !== null, { timeout: 20_000 }).toBe(true);
      const mail = latestMail(email);
      expect(mail).not.toBeNull();
      if (mail === null) throw new Error("invite mail missing");
      return mail;
    }

    const firstMail = await invite(firstEmail);
    expect(firstMail.text).toContain("/login/invite?token=");
    expect(firstMail.html).toContain("Welcome aboard");
    const setPassword = await browser.newContext();
    const inviteePage = await setPassword.newPage();
    await inviteePage.goto(linkFrom(firstMail));
    await expect(inviteePage.locator("#invite-password")).toBeVisible({ timeout: 20_000 });
    await setPassword.close();

    await page.goto("/settings/email-design");
    await page.getByRole("tab", { name: "Templates" }).click();
    await inviteRow.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reset to default" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset to default" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20_000 });

    const secondMail = await invite(secondEmail);
    expect(secondMail.text).toContain("/login/invite?token=");
    expect(secondMail.html).not.toContain("Welcome aboard");
    await shot(page, "p13-invite-template");
  });

  test("branding applies to customer email", async ({ page, request }) => {
    const { adminEmail, dealId } = fixtures();
    await ensureMailbox(page, adminEmail);

    await page.goto("/settings/email-design");
    await page.setInputFiles('input[type="file"]', "e2e/fixtures/email-logo.png");
    await expect(page.getByText("Logo updated.")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Accent colour hex value").fill("#1F5FBF");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Email design saved.")).toBeVisible({ timeout: 20_000 });
    // The accent shows on the quote template's button in the live preview.
    const preview = page.locator('iframe[title="Live preview"]');
    await expect(preview).toBeVisible();
    await expect
      .poll(async () => (await preview.getAttribute("srcdoc")) ?? "", { timeout: 20_000 })
      .toContain("#1F5FBF");
    await shot(page, "p13-email-design");

    const stamp = Date.now();
    const subject = `E2E branded ${stamp}`;
    await composeNew(page, dealId, subject, "Hello from the branded layout.");
    const sent = decodedParts(await waitForSent(adminEmail, "Hello from the branded layout."));
    expect(sent).toContain('data-df-layout="customer-branded"');
    expect(sent).toContain("Hello from the branded layout.");
    expect(sent).toMatch(/\/email-assets\/logo\/[0-9a-f]{16}\.png/);

    const logoPath = /\/email-assets\/logo\/[0-9a-f]{16}\.png/.exec(sent)?.[0] ?? "";
    const logo = await request.get(`http://localhost:3210${logoPath}`);
    expect(logo.status()).toBe(200);
    expect(logo.headers()["content-type"]).toBe("image/png");

    // A reply uses the minimal layout: no logo and no page background.
    await page.goto("/inbox");
    await page.getByRole("link", { name: "Sent" }).click();
    await expect(page.getByText(subject, { exact: false }).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.getByText(subject, { exact: false }).first().click();
    await page
      .getByRole("button", { name: /^Reply$/ })
      .first()
      .click();
    await page.locator('[contenteditable="true"]').first().fill("A personal reply.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const reply = decodedParts(await waitForSent(adminEmail, "A personal reply."));
    expect(reply).toContain('data-df-layout="customer-minimal"');
    expect(reply).not.toContain("/email-assets/logo/");
  });

  test("quote email has summary and button", async ({ page, request }) => {
    const { adminEmail, documentsDealId } = fixtures();
    expect(documentsDealId).not.toBeNull();
    await ensureMailbox(page, adminEmail);

    await page.goto(`/deals/${documentsDealId ?? ""}`);
    const section = page.getByTestId("deal-documents-section");
    await expect(section).toBeAttached();
    await expect(async () => {
      if (!/\/documents\/[0-9a-f-]+$/.test(page.url())) {
        await section.getByTestId("deal-new-quote").click({ timeout: 2_000 });
      }
      await page.waitForURL(/\/documents\/[0-9a-f-]+$/, { timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
    await page.getByTestId("document-send").click();
    const dialog = page.getByTestId("document-send-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    const number = (await page.getByTestId("document-number").first().textContent()) ?? "";
    const sent = decodedParts(await waitForSent(adminEmail, "View quote"));
    expect(sent).toContain('data-df-layout="customer-branded"');
    expect(sent).toContain(number.trim());
    expect(sent).toContain("View quote");
    expect(sent).toContain("Total");
    const publicUrl = /http:\/\/localhost:3210\/d\/[A-Za-z0-9_-]+/.exec(sent)?.[0] ?? "";
    expect(publicUrl).not.toBe("");
    const pageResponse = await request.get(publicUrl);
    expect(pageResponse.status()).toBe(200);
  });

  test("preview matches what is sent", async ({ page }) => {
    const { adminEmail, dealId } = fixtures();
    await ensureMailbox(page, adminEmail);
    const stamp = Date.now();
    const subject = `E2E preview ${stamp}`;
    await page.goto(`/deals/${dealId}`);
    const composer = page.locator('section[aria-label="compose"]');
    await composer.getByRole("tab", { name: "Email" }).click();
    await page.getByPlaceholder("Subject").fill(subject);
    await page
      .locator('[contenteditable="true"]')
      .first()
      .fill("Preview body matches the wire copy.");
    await composer.getByRole("button", { name: "Preview" }).click();
    const iframe = page.locator('iframe[title="Email preview"]');
    await expect(iframe).toBeVisible();
    const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
    expect(srcdoc).toContain('data-df-layout="customer-branded"');
    expect(srcdoc).toContain("Preview body matches the wire copy.");
    await page.getByTestId("dialog-close").click();
    await composer.getByRole("button", { name: "Send", exact: true }).click();
    const sent = decodedParts(await waitForSent(adminEmail, "Preview body matches the wire copy."));
    expect(sent).toContain('data-df-layout="customer-branded"');
    expect(sent).toContain("Preview body matches the wire copy.");
  });

  test("contrast guard", async ({ page }) => {
    await page.goto("/settings/email-design");
    await page.getByLabel("Accent colour hex value").fill("#9BE7B3");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Choose a darker colour/)).toBeVisible({ timeout: 20_000 });
    // Leave the saved accent untouched: the rejected value was never stored.
    await page.getByLabel("Accent colour hex value").fill("#2D8548");
  });
});
