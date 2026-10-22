// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

afterEach(cleanup);

describe("BrandLogo", () => {
  it("renders the colour horizontal master by default at the requested height", () => {
    render(<BrandLogo height={32} />);
    const image = screen.getByRole("img", { name: "Dealflow" });
    expect(image.getAttribute("src")).toBe("/brand/dealflow-logo-horizontal-colour.svg");
    expect(image.getAttribute("height")).toBe("32");
    // 173.34 / 36 aspect ratio, rounded to a whole pixel.
    expect(image.getAttribute("width")).toBe("154");
  });

  it("uses the reverse master on dark surfaces", () => {
    render(<BrandLogo variant="mark" tone="reverse" height={28} />);
    const image = screen.getByRole("img", { name: "Dealflow" });
    expect(image.getAttribute("src")).toBe("/brand/dealflow-mark-reverse.svg");
    expect(image.getAttribute("height")).toBe("28");
    expect(image.getAttribute("width")).toBe("28");
  });
});
