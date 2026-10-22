// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PageToolbar } from "./page-toolbar";

afterEach(cleanup);

it("renders the view switcher, primary action and right-side controls in one 64 px row", () => {
  render(
    <PageToolbar
      left={<span>Views</span>}
      primary={<button type="button">Add deal</button>}
      right={<span>12 deals</span>}
    />,
  );
  const toolbar = screen.getByTestId("page-toolbar");
  expect(toolbar.className).toContain("h-16");
  expect(toolbar.className).toContain("flex-wrap");
  expect(screen.getByText("Views")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add deal" })).toBeInTheDocument();
  const right = screen.getByText("12 deals").parentElement;
  expect(right?.className).toContain("ml-auto");
});
