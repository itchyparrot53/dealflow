// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderSimpleText } from "./renderSimpleText";

afterEach(cleanup);

describe("renderSimpleText", () => {
  it("renders **bold** as a strong element", () => {
    render(<div>{renderSimpleText("This is **bold** text")}</div>);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("renders bullet lines as list items", () => {
    render(<div>{renderSimpleText("- one\n- two")}</div>);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("keeps markup as text instead of creating elements", () => {
    render(<div>{renderSimpleText("<img src=x onerror=alert(1)>")}</div>);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
