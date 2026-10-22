// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PoweredBy } from "./PoweredBy";

afterEach(cleanup);

describe("PoweredBy", () => {
  it("shows the 16 px colour mark beside the existing footer copy", () => {
    const { container } = render(<PoweredBy />);
    const footer = screen.getByTestId("powered-by");
    expect(footer.textContent).toContain("Powered by Dealflow");
    const mark = container.querySelector("img");
    expect(mark?.getAttribute("src")).toBe("/brand/dealflow-mark-colour.svg");
    expect(mark?.getAttribute("width")).toBe("16");
    expect(mark?.getAttribute("height")).toBe("16");
    // The footer is not a link.
    expect(screen.queryByRole("link")).toBeNull();
  });
});
