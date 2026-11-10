import { expect, type Page, test } from "@playwright/test";
import {
  type CampaignMail,
  campaignFixtures,
  campaignMails,
  campaignShot,
  mailsTo,
  oneClickUrl,
  pixelUrl,
  trackedLinkUrl,
  unsubscribePageUrl,
} from "./campaigns/helpers";
import { fixtures, latestMail, linkFrom } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(300_000);
test.describe.configure({ mode: "serial" });

const state: {
  campaignId?: string;
  campaignMail?: CampaignMail;
  sequenceId?: string;
} = {};

async function openPerson(page: Page, email: string): Promise<void> {
  // The person detail opens as a Sheet over the list. A reload is the reliable way to close a
  // previous sheet and reset the list before the next search.
  await page.goto("/contacts/people");
  await page.getByTestId("search-pill").click();
  const search = page.getByRole("searchbox", { name: "Search" });
  await expect(search).toBeVisible();
  await search.fill(email);
  const option = page.getByRole("option").filter({ hasText: email }).first();
  await expect(option).toBeVisible({ timeout: 20_000 });
  await option.click();
  await expect(page.getByRole("dialog", { name: "Person details" })).toBeVisible({
    timeout: 20_000,
  });
}

async function changeMarketingStatus(
  page: Page,
  email: string,
  status: string,
  options: { basis?: string; dialogShot?: string } = {},
): Promise<void> {
  await openPerson(page, email);
  await expect(page.getByTestId("marketing-change")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("marketing-change").click();
  await page.getByTestId("marketing-status-target").click();
  await page.getByRole("option", { name: status, exact: true }).click();
  if (options.basis !== undefined) {
    await page.getByTestId("marketing-basis").click();
    await page.getByRole("option", { name: options.basis, exact: true }).click();
  }
  if (options.dialogShot !== undefined) {
    await campaignShot(page, options.dialogShot);
  }
  await page.getByTestId("marketing-save").click();
  await expect(page.getByTestId("marketing-status")).toContainText(status, {
    timeout: 20_000,
  });
}

async function waitForMail(email: string): Promise<CampaignMail> {
  await expect.poll(() => latestMail(email) !== null, { timeout: 30_000 }).toBe(true);
  const mail = latestMail(email);
  expect(mail, `no mail captured for ${email}`).not.toBeNull();
  return mail as CampaignMail;
}

test("settings and sender", async ({ page }) => {
  await page.goto("/settings/campaigns");
  await expect(page.locator("#campaign-postal-address")).toBeVisible({ timeout: 20_000 });

  await page.locator("#campaign-postal-address").fill("1 Market Street, London");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Add sender" }).click();
  await page.locator("#sender-name").fill("E2E Sender");
  await page.locator("#sender-email").fill("e2e-sender@example.com");
  await page.getByRole("button", { name: "Add and verify" }).click();

  const mail = await waitForMail("e2e-sender@example.com");
  const verifyUrl = linkFrom(mail);
  await page.goto(verifyUrl);
  await expect(page).toHaveURL(/\/settings\/campaigns\?verified=1$/, { timeout: 20_000 });
  await expect(page.getByText("Sender verified.")).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "settings");
});

test("consent", async ({ page, browser }) => {
  const fx = campaignFixtures();
  const [p1, p2, p3, p4, p5] = fx.e2ePeople;
  expect(p1).toBeDefined();
  expect(p2).toBeDefined();
  expect(p3).toBeDefined();
  expect(p4).toBeDefined();
  expect(p5).toBeDefined();
  if (
    p1 === undefined ||
    p2 === undefined ||
    p3 === undefined ||
    p4 === undefined ||
    p5 === undefined
  ) {
    return;
  }

  await openPerson(page, p1.email);
  await expect(page.getByTestId("marketing-status")).toContainText("Subscribed", {
    timeout: 20_000,
  });
  await campaignShot(page, "person-marketing");
  await changeMarketingStatus(page, p2.email, "Subscribed", {
    basis: "Explicit consent",
    dialogShot: "consent-dialog",
  });
  await changeMarketingStatus(page, p3.email, "Subscribed", { basis: "Explicit consent" });
  await changeMarketingStatus(page, p4.email, "Subscribed", { basis: "Explicit consent" });
  await changeMarketingStatus(page, p5.email, "Unsubscribed");

  const form = fixtures();
  expect(form.formPublicId).not.toBeNull();
  if (form.formPublicId === null) return;
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  const email = `consent.${Date.now()}@example.com`;

  await visitorPage.goto(`/f/${form.formPublicId}`);
  await expect(visitorPage.getByTestId("public-form")).toBeVisible({ timeout: 20_000 });
  await visitorPage.waitForTimeout(2_500);
  await visitorPage
    .locator('[data-testid="public-form-field"][data-key="name"] input')
    .fill("Consent Visitor");
  await visitorPage
    .locator('[data-testid="public-form-field"][data-key="email"] input')
    .fill(email);
  await visitorPage
    .locator('[data-testid="public-form-field"][data-key="marketing_consent"] input')
    .check();
  await visitorPage.getByTestId("public-form-submit").click();
  await expect(visitorPage.getByTestId("public-form-success")).toBeVisible({ timeout: 20_000 });

  const doi = await waitForMail(email);
  await visitorPage.goto(linkFrom(doi));
  await expect(visitorPage.getByRole("button", { name: "Confirm" })).toBeVisible({
    timeout: 20_000,
  });
  await campaignShot(visitorPage, "double-opt-in");
  await visitorPage.getByRole("button", { name: "Confirm" }).click();
  await expect(visitorPage.getByText("You're subscribed")).toBeVisible({ timeout: 20_000 });
  await visitor.close();

  await openPerson(page, email);
  await expect(page.getByTestId("marketing-status")).toContainText("Subscribed", {
    timeout: 20_000,
  });
  await page.getByTestId("marketing-history").click();
  const history = page.getByTestId("marketing-history-list");
  await expect(history).toBeVisible();
  await expect(history).toContainText("Pending");
  await expect(history).toContainText("Subscribed");
  await expect(history).toContainText("double_opt_in");
  await page.getByRole("dialog", { name: "Consent history" }).getByTestId("dialog-close").click();
});

test("campaign send", async ({ page }) => {
  await page.goto("/campaigns");
  await expect(page.getByRole("table")).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "list");

  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByTestId("starter-use-announcement").click();
  await page.waitForURL(/\/campaigns\/[0-9a-f-]+$/, { timeout: 30_000 });
  state.campaignId = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(state.campaignId).not.toBe("");

  await page.locator("#campaign-name").fill("E2E campaign");
  await page.locator("#campaign-subject").fill("E2E subject");
  await page.getByTestId("campaign-sender").click();
  await page.getByRole("option", { name: /E2E Sender/ }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "details");

  await page.getByTestId("campaign-step-recipients").click();
  await page.getByTestId("campaign-saved-filter").click();
  await page.getByRole("option", { name: fxFilterName() }).click();
  await expect(page.getByText("4 people will receive this campaign.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/1 unsubscribed/)).toBeVisible();
  await campaignShot(page, "recipients");

  await page.getByTestId("campaign-step-content").click();
  await expect(page.getByTestId("builder-desktop")).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "builder");
  await page.getByTestId("builder-mobile").click();
  await campaignShot(page, "builder-mobile");
  await page
    .getByRole("button", { name: /^Heading:/ })
    .first()
    .click();
  await page.locator("#block-heading-text").fill("E2E headline");
  await page.waitForTimeout(1_200);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("campaign-step-review").click();
  await expect(page.getByText("Sender is verified")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Postal address is set in Settings > Campaigns")).toBeVisible();
  await campaignShot(page, "review");

  await page.getByTestId("campaign-send-test").click();
  await page.getByTestId("campaign-test-recipients").fill("demo1@example.com");
  await page.getByTestId("campaign-test-person").click();
  await page.getByRole("option").first().click();
  await page.getByTestId("campaign-test-send").click();
  await expect(page.getByTestId("campaign-test-sent")).toContainText("Sent 1 test email", {
    timeout: 20_000,
  });
  await page.keyboard.press("Escape");

  await page.getByTestId("campaign-send-now").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send now", exact: true })
    .click();
  await expect.poll(() => campaignMails(state.campaignId).length, { timeout: 120_000 }).toBe(4);
  // The send action reloads while the worker is still on its first tick; reload once more after
  // the captured mail proves the campaign finished.
  await page.reload();
  await expect(page.locator("header").getByText("sent", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const campaignId = state.campaignId ?? "";
  const mails = campaignMails(campaignId);
  for (const mail of mails) {
    expect(mail.headers?.["List-Unsubscribe"]).toContain("/u/");
    expect(mail.headers?.["List-Unsubscribe"]).toContain("/one-click");
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail.html).toContain("1 Market Street, London");
    expect(mail.html).toContain("Unsubscribe");
    expect(mail.html).toContain("/u/");
  }
  const firstPerson = campaignFixtures().e2ePeople[0];
  state.campaignMail =
    mails.find(
      (mail) => mail.to.trim().toLowerCase() === firstPerson?.email.trim().toLowerCase(),
    ) ?? mails[0];
});

function fxFilterName(): string {
  return campaignFixtures().filterName;
}

test("tracking", async ({ page }) => {
  const mail = state.campaignMail;
  expect(mail).toBeDefined();
  if (mail === undefined) return;
  const campaignId = state.campaignId;
  expect(campaignId).toBeDefined();
  if (campaignId === undefined) return;

  const pixel = pixelUrl(mail);
  const link = trackedLinkUrl(mail);
  expect(pixel).not.toBeNull();
  expect(link).not.toBeNull();
  if (pixel === null || link === null) return;

  await page.waitForTimeout(2_000);
  const pixelResponse = await page.request.get(pixel);
  expect(pixelResponse.status()).toBe(200);
  expect(pixelResponse.headers()["content-type"]).toContain("image/gif");
  const clickResponse = await page.request.get(link, { maxRedirects: 0 });
  expect(clickResponse.status()).toBe(302);
  expect(clickResponse.headers()["location"]).toMatch(/^https:\/\/example\.com\/?$/);

  await page.goto(`/campaigns/${campaignId}/report`);
  await expect(page.getByTestId("campaign-report")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("report-unique-opens")).toContainText("1");
  await expect(page.getByTestId("report-unique-clicks")).toContainText("1");
  await campaignShot(page, "report");

  await openPerson(page, mail.to);
  await expect(page.getByText(/Clicked example\.com in/).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("unsubscribe", async ({ page }) => {
  const fx = campaignFixtures();
  // Keep the first campaign recipient (used by tracking/report and the sequence test) subscribed;
  // unsubscribe a different one so the two tests cannot race on shared state.
  const target = fx.e2ePeople[1];
  expect(target).toBeDefined();
  if (target === undefined) return;
  const mail =
    campaignMails().find(
      (candidate) => candidate.to.trim().toLowerCase() === target.email.trim().toLowerCase(),
    ) ?? state.campaignMail;
  expect(mail).toBeDefined();
  if (mail === undefined) return;
  const oneClick = oneClickUrl(mail);
  const pageUrl = unsubscribePageUrl(mail);
  expect(oneClick).not.toBeNull();
  expect(pageUrl).not.toBeNull();
  if (oneClick === null || pageUrl === null) return;

  await page.goto(pageUrl);
  await expect(page.getByText(/Unsubscribe/).first()).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "unsubscribe");

  const response = await page.request.post(oneClick, {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(response.status()).toBe(200);

  await openPerson(page, mail.to);
  await expect(page.getByTestId("marketing-status")).toContainText("Unsubscribed", {
    timeout: 20_000,
  });

  await page.goto("/campaigns");
  const row = page.getByRole("row").filter({ hasText: "E2E campaign" }).first();
  await row.getByTestId("campaign-row-menu").click();
  await page.getByTestId("campaign-duplicate").click();
  await page.waitForURL(/\/campaigns\/[0-9a-f-]+$/, { timeout: 30_000 });
  await page.getByTestId("campaign-step-recipients").click();
  await expect(page.getByText("3 people will receive this campaign.")).toBeVisible({
    timeout: 20_000,
  });
});

test("sequence", async ({ page }) => {
  await page.goto("/campaigns/automated");
  await page.getByTestId("sequence-new").click();
  await page.waitForURL(/\/campaigns\/automated\/[0-9a-f-]+$/, { timeout: 30_000 });
  state.sequenceId = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(state.sequenceId).not.toBe("");

  await page.getByTestId("sequence-name").fill("E2E sequence");
  await page.getByTestId("sequence-sender").click();
  await page.getByRole("option", { name: /E2E Sender/ }).click();
  await page.getByTestId("sequence-save").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("sequence-activate").click();
  await expect(page.getByTestId("sequence-pause")).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "sequence-editor");

  const fx = campaignFixtures();
  const person = fx.e2ePeople[0];
  expect(person).toBeDefined();
  if (person === undefined) return;

  await page.goto("/contacts/people");
  await page.getByRole("button", { name: "Saved views" }).click();
  await page.getByRole("menuitem", { name: fx.filterName, exact: true }).click();
  const personRow = page.getByRole("row").filter({ hasText: person.name }).first();
  await expect(personRow).toBeVisible({ timeout: 20_000 });
  await personRow.getByRole("checkbox").check();
  await page.getByTestId("bulk-enroll-sequence").click();
  await page.getByRole("option", { name: "E2E sequence", exact: true }).click();

  await expect
    .poll(() => mailsTo(person.email).filter((mail) => mail.subject === "A quick note").length, {
      timeout: 180_000,
    })
    .toBeGreaterThanOrEqual(1);
});

test("gallery", async ({ page }) => {
  const fx = campaignFixtures();
  await page.goto("/campaigns?view=insights");
  await expect(page.getByText("Your average").first()).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "insights");

  await page.goto(`/v/${fx.newsletterToken}`);
  await expect(page.locator("iframe")).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "newsletter-email");

  await page.goto(`/v/${fx.announcementToken}`);
  await expect(page.locator("iframe")).toBeVisible({ timeout: 20_000 });
  await campaignShot(page, "announcement-email");
});
