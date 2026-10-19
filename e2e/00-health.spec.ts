import { expect, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

// Copied verbatim from STRINGS.errors.boundaryTitle. Hard-coded on purpose: the check must keep
// looking for the exact phrase even if the constant is reworded.
const BOUNDARY_TITLE = "Something went wrong";

test.use({ storageState: ".e2e/admin.json" });

const PAGES: { path: string; name: string }[] = [
  { path: "/pipeline", name: "pipeline" },
  { path: `/deals/${fixtures().dealId}`, name: "deal" },
  { path: "/contacts/people", name: "people" },
  { path: "/contacts/orgs", name: "orgs" },
  { path: "/leads", name: "leads" },
  { path: "/activities", name: "activities" },
  { path: "/inbox", name: "inbox" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/settings/profile", name: "settings" },
];

for (const { path, name } of PAGES) {
  test(`renders ${path} for a signed-in admin`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status() ?? 0).toBeLessThan(400);
    expect(page.url()).not.toContain("/login");
    await expect(page.getByRole("heading", { name: BOUNDARY_TITLE })).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await shot(page, `p1-00-${name}`);
  });
}
