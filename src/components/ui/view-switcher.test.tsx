// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LayoutGrid, List } from "lucide-react";
import { afterEach, expect, it, vi } from "vitest";
import { ViewSwitcher } from "./view-switcher";

afterEach(cleanup);

const OPTIONS = [
  { value: "board", label: "Board", icon: <LayoutGrid /> },
  { value: "list", label: "List", icon: <List /> },
];

it("renders a segmented switcher and marks the current view", () => {
  render(<ViewSwitcher options={OPTIONS} value="board" onChange={vi.fn()} />);
  expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "false");
});

it("reports the view the user picked", () => {
  const onChange = vi.fn();
  render(<ViewSwitcher options={OPTIONS} value="board" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "List" }));
  expect(onChange).toHaveBeenCalledWith("list");
});
