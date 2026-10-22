// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isNavActive, LeftNav } from "./LeftNav";

// LeftNav reads the current path via usePathname to mark the active item; mock it so the
// component renders outside an app-router provider.
vi.mock("next/navigation", () => ({ usePathname: () => "/pipeline" }));

afterEach(cleanup);

describe("LeftNav (Pipedrive rail)", () => {
  test("is a 56 px indigo rail with the app mark at the top", () => {
    render(<LeftNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.getAttribute("data-testid")).toBe("app-rail");
    expect(nav.className).toContain("w-14");
    expect(nav.className).toContain("bg-rail");
    expect(nav.className).toContain("h-full");
    const home = screen.getByRole("link", { name: "Dealflow home" });
    expect(home.getAttribute("href")).toBe("/");
    const mark = screen.getByRole("img", { name: "Dealflow" });
    expect(mark.getAttribute("src")).toBe("/brand/dealflow-mark-reverse.svg");
    expect(mark.getAttribute("width")).toBe("28");
    expect(mark.getAttribute("height")).toBe("28");
    // The old cell forced the raster icon white; the reverse SVG carries the brand colours.
    expect(mark.className).not.toContain("brightness-0");
  });

  test("renders every destination as an icon-only 44 px link with its label as the name", () => {
    render(<LeftNav />);
    const pipeline = screen.getByRole("link", { name: "Pipeline" });
    expect(pipeline.className).toContain("size-11");
    expect(pipeline.className).toContain("rounded-lg");
    expect(pipeline.querySelector("svg")).not.toBeNull();
    // The rail no longer paints text labels; the label is the accessible name (tooltip on hover).
    expect(pipeline.textContent).toBe("");
  });

  test("marks the active section with the violet tile and aria-current", () => {
    render(<LeftNav />);
    const pipeline = screen.getByRole("link", { name: "Pipeline" });
    expect(pipeline.getAttribute("aria-current")).toBe("page");
    expect(pipeline.className).toContain("bg-rail-active");
    expect(screen.getByRole("link", { name: "Contacts" }).getAttribute("aria-current")).toBeNull();
  });

  test("moves Settings into the top bar, so the rail does not carry it", () => {
    render(<LeftNav />);
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.getByRole("link", { name: "Performance" })).toBeTruthy();
  });

  test("highlights the pipeline destination on the deal workspace", () => {
    expect(isNavActive("/deals/abc", "/pipeline")).toBe(true);
    expect(isNavActive("/deals", "/pipeline")).toBe(true);
    expect(isNavActive("/contacts/people", "/pipeline")).toBe(false);
  });

  test("has no collapse control: the rail is always icon-only", () => {
    render(<LeftNav />);
    expect(screen.queryByRole("button", { name: /sidebar/i })).toBeNull();
    expect(renderToStaticMarkup(<LeftNav />)).not.toMatch(/w-56\b/);
  });
});
