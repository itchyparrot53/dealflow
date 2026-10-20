import { expect, test } from "@playwright/test";
import {
  deliverFakeMail,
  fakeFolder,
  fixtures,
  latestMail,
  linkFrom,
  readFakeMail,
  shot,
  waitForText,
} from "./helpers";

test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(180_000);

const APP_PASSWORD = "fake-app-password-1";

async function openThreadWithMessages(
  page: import("@playwright/test").Page,
  subject: string,
  expected: number,
): Promise<void> {
  // Sync runs every five seconds, so the newest message may not be in the thread yet. Retry the
  // whole open-and-count step; expect().toPass reports the last count when the budget runs out.
  await expect(async () => {
    await page.goto("/inbox");
    await page.getByText(subject, { exact: false }).first().click();
    await expect(page.getByTestId("reader-message-card").first()).toBeVisible({
      timeout: 5_000,
    });
    expect(await page.getByTestId("reader-message-card").count()).toBe(expected);
  }).toPass({ timeout: 90_000, intervals: [2_000, 3_000, 5_000] });
}

test.describe("IMAP mailbox", () => {
  test("connects, syncs, replies, threads and resets a password", async ({ page }) => {
    const { adminEmail, personEmail, personDealId, personId } = fixtures();
    const ts = Date.now();
    const firstId = `<e2e-a-${ts}@example.net>`;
    const subject = `E2E inbound ${ts}`;

    await page.goto("/settings/email-sync");
    // The demo data ships a Gmail mailbox for demo1; disconnect it so this spec can prove the
    // IMAP connect flow on the same user.
    const disconnect = page.getByRole("button", { name: "Disconnect" });
    if (await disconnect.isVisible()) {
      await disconnect.click();
      await expect(page.getByTestId("connect-mailbox-form")).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByTestId("connect-mailbox-form")).toBeVisible();
    await shot(page, "p2-email-sync-connect");

    await page.getByLabel("Email address").fill(adminEmail);
    await page.getByLabel("App password").fill("short");
    await page.getByRole("button", { name: "Test and connect" }).click();
    await expect(page.getByTestId("connect-error")).toContainText("rejected");
    await shot(page, "p2-email-sync-error");

    await page.getByLabel("App password").fill(APP_PASSWORD);
    await page.getByRole("button", { name: "Test and connect" }).click();
    const status = page.getByTestId("mailbox-status");
    await expect(status).toHaveAttribute("data-provider", "imap", { timeout: 30_000 });
    await expect(status).toHaveAttribute("data-status", "connected");
    await shot(page, "p2-email-sync-connected");

    // Inbound mail from the seeded contact auto-links to that contact and their deal.
    deliverFakeMail({
      to: adminEmail,
      from: personEmail,
      subject,
      messageId: firstId,
      text: "Here are the details you asked for.",
    });
    await page.goto("/inbox");
    await page.waitForTimeout(8_000);
    await waitForText(page, subject, 90_000);
    await shot(page, "p2-inbox-synced");

    // Reply into the thread from the reader.
    await page.getByText(subject, { exact: false }).first().click();
    await expect(page.getByTestId("reader-message-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    const body = page.locator('[contenteditable="true"]').last();
    await body.click();
    await page.keyboard.type("Thanks, sending details shortly.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const sentReply = page.getByText("Thanks, sending details shortly.").first();
    await expect(sentReply).toBeVisible({ timeout: 30_000 });
    await sentReply.scrollIntoViewIfNeeded();
    await shot(page, "p2-thread-reply");

    // The reply reached the contact's mailbox with an In-Reply-To header, and our Sent copy holds
    // its deterministic Message-ID for the next message's References chain.
    const inbox = fakeFolder(personEmail, "INBOX");
    expect(inbox.length).toBeGreaterThanOrEqual(1);
    const newestInbox = inbox.sort().at(-1) ?? "";
    expect(readFakeMail(personEmail, "INBOX", newestInbox)).toContain(`In-Reply-To: ${firstId}`);
    const sentFiles = fakeFolder(adminEmail, "Sent");
    expect(sentFiles.length).toBeGreaterThanOrEqual(1);
    const newestSent = sentFiles.sort().at(-1) ?? "";
    const replyId = /^Message-ID: (.+)$/im.exec(readFakeMail(adminEmail, "Sent", newestSent))?.[1];
    if (replyId === undefined) throw new Error("reply has no Message-ID");

    // A third message referencing both arrives in the same thread.
    deliverFakeMail({
      to: adminEmail,
      from: personEmail,
      subject: `Re: ${subject}`,
      messageId: `<e2e-b-${ts}@example.net>`,
      text: "Adding the signed contract.",
      references: [firstId, replyId.trim()],
    });
    await openThreadWithMessages(page, subject, 3);
    await shot(page, "p2-thread-three-messages");

    // The thread shows on the linked deal's timeline; the contact page is the documented fallback
    // only when the seeded contact has no deal.
    if (personDealId !== null) {
      await page.goto(`/deals/${personDealId}`);
      await expect(page.getByText(subject, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      });
    } else {
      if (personId === null) throw new Error("no contact for the email timeline screenshot");
      await page.goto(`/contacts/people/${personId}`);
      await expect(page.getByText(subject, { exact: false }).first()).toBeVisible({
        timeout: 30_000,
      });
    }
    await shot(page, "p2-deal-email-timeline");

    // A magic-link sign-in may reset the password without the current one for 15 minutes.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByRole("tab", { name: "Email link" }).click();
    await page.locator("#link-email").fill(adminEmail);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByTestId("login-sent")).toBeVisible();
    const mail = latestMail(adminEmail);
    if (mail === null) throw new Error("no sign-in mail captured");
    await page.goto(linkFrom(mail));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/pipeline/);
    await page.goto("/settings/profile");
    const resetNote = page.getByTestId("password-reset-note");
    await expect(resetNote).toBeVisible();
    await resetNote.scrollIntoViewIfNeeded();
    await shot(page, "p2-profile-password-reset");
  });
});
