// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const changeStageAction = vi.hoisted(() => vi.fn());
vi.mock("@/features/deal-workspace/actions", () => ({ changeStageAction }));
vi.mock("@/features/deal-workspace/DealActionErrorProvider", () => ({
  useDealActionError: () => vi.fn(),
}));
vi.mock("@/features/feedback/undo", () => ({ pushStageUndo: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/utils/csrfCookie", () => ({ readCsrfToken: () => "csrf" }));

import { StageTrack } from "./StageTrack";

afterEach(() => {
  cleanup();
  changeStageAction.mockReset();
});

const CHIPS = [
  { id: "s1", name: "Qualified", current: false, passed: true, days: 4 },
  { id: "s2", name: "Proposal", current: true, passed: false, days: 3 },
  { id: "s3", name: "Negotiation", current: false, passed: false, days: 0 },
];

describe("StageTrack", () => {
  it("renders one 24 px segment per stage with its day count", () => {
    render(<StageTrack dealId="d1" expectedUpdatedAt="t1" chips={CHIPS} />);
    expect(screen.getByTestId("stage-track")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Proposal, 3 days" })).toHaveTextContent("3 days");
    expect(screen.getByRole("option", { name: "Qualified, 4 days" })).toHaveTextContent("4 days");
  });

  it("marks passed and current green, future grey, and the current step as selected", () => {
    render(<StageTrack dealId="d1" expectedUpdatedAt="t1" chips={CHIPS} />);
    const passed = screen.getByRole("option", { name: "Qualified, 4 days" });
    const current = screen.getByRole("option", { name: "Proposal, 3 days" });
    const future = screen.getByRole("option", { name: "Negotiation, 0 days" });
    for (const segment of [passed, current]) {
      expect(segment.getAttribute("data-state")).toMatch(/passed|current/);
      expect(segment.className).toContain("bg-primary");
    }
    expect(future.getAttribute("data-state")).toBe("future");
    expect(future.className).toContain("bg-track");
    expect(future.className).toContain("text-track-foreground");
    expect(current).toHaveAttribute("aria-selected", "true");
    expect(passed).toHaveAttribute("aria-selected", "false");
  });

  it("keeps the stage-change behaviour: clicking a future segment moves the deal", async () => {
    changeStageAction.mockResolvedValue({ ok: true, deal: { updatedAt: "t2" } });
    render(<StageTrack dealId="d1" expectedUpdatedAt="t1" chips={CHIPS} />);
    fireEvent.click(screen.getByRole("option", { name: "Negotiation, 0 days" }));
    await waitFor(() =>
      expect(changeStageAction).toHaveBeenCalledWith(
        { dealId: "d1", toStageId: "s3", expectedUpdatedAt: "t1" },
        "csrf",
      ),
    );
  });

  it("does not move the deal when the current segment is clicked", () => {
    render(<StageTrack dealId="d1" expectedUpdatedAt="t1" chips={CHIPS} />);
    fireEvent.click(screen.getByRole("option", { name: "Proposal, 3 days" }));
    expect(changeStageAction).not.toHaveBeenCalled();
  });
});
