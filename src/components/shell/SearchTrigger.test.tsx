// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SearchTrigger } from "./SearchTrigger";

afterEach(cleanup);

// Part 11 turns the trigger into the 240x40 pill; the placeholder now lives in a truncating span
// inside it, because the button itself is a fixed-size flex box.
it("truncates the placeholder inside the search pill", () => {
  render(<SearchTrigger />);
  const trigger = screen.getByRole("button", { name: "Open search" });
  expect(trigger).toHaveClass("rounded-full");
  expect(screen.getByText("Search Dealflow")).toHaveClass("truncate");
});
