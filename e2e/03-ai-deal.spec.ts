import { expect, test } from "@playwright/test";
import { fixtures, shot } from "./helpers";

test.use({ storageState: ".e2e/admin.json" });

test.describe("deal AI", () => {
  test("summary, addable next step, score, and notes to activities", async ({ page }) => {
    const { dealId } = fixtures();
    await page.goto(`/deals/${dealId}`);
    const card = page.getByTestId("deal-ai-card");
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Generate summary" }).click();
    await expect(page.getByTestId("deal-ai-summary")).toContainText("FAKE summary of this deal.", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("deal-ai-health")).toHaveAttribute("data-health", "at_risk");

    const firstStep = page.getByTestId("deal-ai-next-step").first();
    await firstStep.getByRole("button", { name: "Add" }).click();
    await expect(firstStep).toHaveAttribute("data-added", "true");
    // The next step is on the card already; the activity adds a second copy on the timeline.
    await expect.poll(async () => page.getByText("FAKE follow-up call").count()).toBeGreaterThan(1);

    await card.getByRole("button", { name: "Score deal" }).click();
    await expect(page.getByTestId("deal-ai-score")).toHaveAttribute("data-score", "72");
    await shot(page, "p1-deal-ai-card");

    // Notes to activities: write a note, open its menu, propose, create the first follow-up.
    await page.locator('section[aria-label="compose"]').getByRole("tab", { name: "Notes" }).click();
    await page
      .getByRole("textbox", { name: "Note", exact: true })
      .fill("Call went well, send pricing Friday");
    await page.getByRole("button", { name: "Save" }).click();
    const note = page.getByText("Call went well, send pricing Friday");
    await expect(note).toBeVisible();

    const noteCard = note.locator("xpath=ancestor::div[contains(@class,'bg-warning/10')]");
    await noteCard.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Turn into activities" }).click();

    await expect(page.getByRole("dialog", { name: "Suggested activities" })).toBeVisible();
    const proposal = page.getByTestId("ai-proposal").first();
    // The subject is an editable input value, not text.
    await expect(proposal.getByRole("textbox", { name: "Subject" })).toHaveValue(
      "FAKE follow-up task",
    );
    await shot(page, "p1-notes-to-activities");
    await page.getByRole("button", { name: "Create selected" }).click();
    await expect(page.getByRole("dialog", { name: "Suggested activities" })).toBeHidden();
    await expect(page.getByText("FAKE follow-up task").first()).toBeVisible();
  });
});
