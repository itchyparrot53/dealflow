import { expect, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });

function fakeTool(dealId: string, body: string): string {
  return `/fake-tool {"name":"add_note","arguments":{"entityType":"deal","entityId":"${dealId}","body":"${body}"}}`;
}

test.describe("assistant", () => {
  test("answers, proposes a note, confirms it, and rejects the next proposal", async ({ page }) => {
    const { dealId } = fixtures();
    await page.goto("/pipeline");

    await page.getByTestId("assistant-trigger").click();
    await expect(page.getByRole("dialog", { name: "Assistant" })).toBeVisible();
    await expect(page.getByTestId("assistant-suggestion")).toHaveCount(3);
    await shot(page, "p1-assistant-empty");

    const input = page.getByLabel("Message the assistant");
    await input.fill("hello");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(
      page.getByTestId("assistant-message").filter({ hasText: "FAKE AI: hello" }),
    ).toBeVisible();

    // A write tool only proposes: it is not executed until Confirm.
    await input.fill(fakeTool(dealId, "Assistant note E2E"));
    await page.getByRole("button", { name: "Send" }).click();
    const pending = page.getByTestId("assistant-action").first();
    await expect(pending).toHaveAttribute("data-status", "pending");
    await shot(page, "p1-assistant-pending");

    // Close the drawer, and prove the note is not on the deal yet.
    await page.keyboard.press("Escape");
    await page.goto(`/deals/${dealId}`);
    await expect(page.getByText("Assistant note E2E")).toHaveCount(0);

    // Confirm from the conversation: the note is created and the message says Done.
    await page.getByTestId("assistant-trigger").click();
    await page
      .getByTestId("assistant-action")
      .first()
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByTestId("assistant-action").first()).toHaveAttribute(
      "data-status",
      "confirmed",
    );
    await expect(page.getByTestId("assistant-message").filter({ hasText: "Done:" })).toBeVisible();
    await shot(page, "p1-assistant-confirmed");

    await page.keyboard.press("Escape");
    await page.goto(`/deals/${dealId}`);
    await expect(page.getByText("Assistant note E2E").first()).toBeVisible();

    // A second proposal is rejected instead.
    await page.getByTestId("assistant-trigger").click();
    await page
      .getByLabel("Message the assistant")
      .fill(fakeTool(dealId, "Assistant note rejected"));
    await page.getByRole("button", { name: "Send" }).click();
    const second = page.getByTestId("assistant-action").last();
    await expect(second).toHaveAttribute("data-status", "pending");
    await second.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("assistant-action").last()).toHaveAttribute(
      "data-status",
      "rejected",
    );
    await expect(
      page.getByTestId("assistant-message").filter({ hasText: "Cancelled:" }),
    ).toBeVisible();
  });
});
