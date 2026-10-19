import { expect, test } from "@playwright/test";
import { E2E_ADMIN_PASSWORD, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });

interface InviteResult {
  email: string;
  link: string;
}

async function inviteOne(page: import("@playwright/test").Page): Promise<InviteResult> {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/settings/users");
  const form = page.locator("form[novalidate]");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Name", { exact: true }).fill("E2E Invitee");
  await form.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByTestId("invite-result")).toBeVisible();
  const link = await page.getByTestId("invite-link").inputValue();
  await shot(page, "p1-users-invite");
  return { email, link };
}

test.describe("invite and profile password", () => {
  test("invite sends a set-password link and the invitee signs in with it", async ({
    page,
    browser,
  }) => {
    const invited = await inviteOne(page);
    expect(invited.link).toContain("/login/invite?token=");

    const fresh = await browser.newContext();
    const invitee = await fresh.newPage();
    await invitee.goto(invited.link);
    await invitee.getByLabel("Name", { exact: true }).fill("E2E Invitee");
    await invitee.getByLabel("New password", { exact: true }).fill("invitee password 123");
    await invitee.getByLabel("Confirm password", { exact: true }).fill("invitee password 123");
    await shot(invitee, "p1-invite-accept");
    await invitee.getByRole("button", { name: "Set password and sign in" }).click();
    await expect(invitee).toHaveURL(/\/pipeline/);
    await expect(invitee.getByRole("button", { name: "Account menu" })).toBeVisible();
    await fresh.close();
  });

  test("the profile changes the password and then restores it", async ({ page }) => {
    const temporary = "temporary admin password 1";
    await page.goto("/settings/profile");
    await expect(page.getByTestId("password-card")).toBeVisible();

    await page.getByLabel("Current password", { exact: true }).fill(E2E_ADMIN_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(temporary);
    await page.getByLabel("Confirm new password", { exact: true }).fill(temporary);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByTestId("password-saved")).toBeVisible();
    await shot(page, "p1-profile-password");

    // Restore the shared e2e password so a fresh sign-in still works afterwards.
    await page.getByLabel("Current password", { exact: true }).fill(temporary);
    await page.getByLabel("New password", { exact: true }).fill(E2E_ADMIN_PASSWORD);
    await page.getByLabel("Confirm new password", { exact: true }).fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByTestId("password-saved")).toBeVisible();
  });
});
