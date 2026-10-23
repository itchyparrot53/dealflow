// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { StageChevron } from "./StageChevron";

afterEach(cleanup);

const STAGES = [
  { id: "s1", name: "Qualified" },
  { id: "s2", name: "Contact made" },
  { id: "s3", name: "Won" },
];

it("renders one text-free radio per stage with the caption under the track", () => {
  render(<StageChevron stages={STAGES} selectedId="s2" onSelect={() => {}} />);
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(3);
  expect(radios[0]).toHaveAttribute("aria-label", "Qualified");
  expect(radios[1]).toHaveAttribute("aria-checked", "true");
  expect(radios[2]).toHaveAttribute("aria-checked", "false");
  // The stage name is the caption, not text inside the segment.
  expect(screen.getByText("Stage 2 of 3")).toBeInTheDocument();
});

it("moves the selection with the arrow keys", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<StageChevron stages={STAGES} selectedId="s1" onSelect={onSelect} />);
  const first = screen.getByRole("radio", { name: "Qualified" });
  first.focus();
  await user.keyboard("{ArrowRight}");
  expect(onSelect).toHaveBeenCalledWith("s2");
});
