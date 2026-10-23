// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormField, FormGrid } from "./form-field";

afterEach(cleanup);

describe("FormField", () => {
  it("associates the label with the control", () => {
    render(
      <FormField label="Deal title" htmlFor="deal-title">
        <input id="deal-title" />
      </FormField>,
    );
    expect(screen.getByLabelText("Deal title")).toHaveAttribute("id", "deal-title");
  });

  it("marks a required field on the control and with a decorative asterisk", () => {
    render(
      <FormField label="Value" htmlFor="value" required>
        <input id="value" />
      </FormField>,
    );
    expect(screen.getByLabelText("Value")).toHaveAttribute("aria-required", "true");
    const marker = screen.getByText("*");
    expect(marker).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the hint when there is no error", () => {
    render(
      <FormField label="Email" hint="We never share it">
        <input />
      </FormField>,
    );
    expect(screen.getByText("We never share it")).toHaveClass("text-meta");
  });

  it("lets the error win over the hint and announces it", () => {
    render(
      <FormField label="Email" hint="We never share it" error="Enter a valid address">
        <input />
      </FormField>,
    );
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Enter a valid address");
    expect(error).toHaveClass("text-destructive");
    expect(screen.queryByText("We never share it")).not.toBeInTheDocument();
  });
});

describe("FormGrid", () => {
  it("renders one column by default", () => {
    render(
      <FormGrid>
        <input aria-label="one" />
      </FormGrid>,
    );
    const grid = screen.getByLabelText("one").parentElement;
    expect(grid?.className).toContain("grid");
    expect(grid?.className).not.toContain("sm:grid-cols-2");
  });

  it("renders two columns at sm and spans a full-width child", () => {
    render(
      <FormGrid columns={2}>
        <input aria-label="one" data-span="full" />
        <input aria-label="two" />
      </FormGrid>,
    );
    const grid = screen.getByLabelText("one").parentElement;
    expect(grid?.className).toContain("sm:grid-cols-2");
    expect(grid?.className).toContain("[&>[data-span=full]]:col-span-2");
  });
});
