// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyCell, TableFooter } from "./table-parts";

afterEach(cleanup);

describe("EmptyCell", () => {
  it("renders a muted dash with an accessible Empty label", () => {
    render(<EmptyCell />);
    expect(screen.getByText("-")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});

describe("TableFooter", () => {
  it("puts the count on the left and the control on the right", () => {
    render(
      <TableFooter count="Showing 50 of 107">
        <button type="button">Load more</button>
      </TableFooter>,
    );
    expect(screen.getByText("Showing 50 of 107")).toHaveClass("text-meta");
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });
});
