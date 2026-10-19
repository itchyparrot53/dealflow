import { expect, test } from "@playwright/test";
import { E2E_ADMIN_PASSWORD, latestMail, linkFrom, shot } from "./helpers";

// No storage state: this spec proves the sign-in surface itself.
test.describe("local sign-in", () => {
  test("password, sign out, single-use link, and the same notice for an unknown email", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("tab", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Email link" })).toBeVisible();
    await shot(page, "p1-login");

    // Wrong password answers with the same generic error as an unknown account.
    await page.locator("#login-email").fill("demo1@example.com");
    await page.locator("#login-password").fill("definitely wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();

    // The error redirect re-renders the form empty, so both fields are filled again.
    await page.locator("#login-email").fill("demo1@example.com");
    await page.locator("#login-password").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/pipeline/);

    // Signing out revokes every session for the user, including the seeded storage state, so this
    // spec saves its own signed-in state at the end for the specs that follow.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Email link: the notice is shown, and the capture mailer has the message.
    await page.getByRole("tab", { name: "Email link" }).click();
    await page.locator("#link-email").fill("demo1@example.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByTestId("login-sent")).toBeVisible();
    await shot(page, "p1-login-sent");

    const mail = latestMail("demo1@example.com");
    expect(mail, "the magic-link email was captured").not.toBeNull();
    if (mail === null) return;
    const link = linkFrom(mail);

    await page.goto(link);
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await shot(page, "p1-magic-confirm");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/pipeline/);

    // The link is single use.
    await page.goto(link);
    await expect(page.getByTestId("magic-invalid")).toBeVisible();

    // An unknown address gets the same notice and no email.
    await page.goto("/login");
    await page.getByRole("tab", { name: "Email link" }).click();
    await page.locator("#link-email").fill("unknown-e2e@example.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByTestId("login-sent")).toBeVisible();
    expect(latestMail("unknown-e2e@example.com"), "no mail for an unknown address").toBeNull();

    // Hand a valid demo1 session to the specs that run after this one.
    await page.context().storageState({ path: ".e2e/admin.json" });
  });
});
