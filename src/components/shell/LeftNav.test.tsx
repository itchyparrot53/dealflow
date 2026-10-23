// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isNavActive, LeftNav } from "./LeftNav";

// LeftNav reads the current path via usePathname to mark the active item; mock it so the
// component renders outside an app-router provider.
vi.mock("next/navigation", () => ({ usePathname: () => "/pipeline" }));

afterEach(() => {
  cleanup();
  // The toggle writes the preference cookie; clear it so one test cannot seed the next.
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (name !== undefined && name !== "") {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
});

describe("LeftNav (expandable rail)", () => {
  test("starts expanded at 232 px with the horizontal logo and visible labels", () => {
    render(<LeftNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.getAttribute("data-testid")).toBe("app-rail");
    expect(nav.getAttribute("data-state")).toBe("expanded");
    expect(nav.className).toContain("w-[232px]");
    expect(nav.className).toContain("bg-rail");
    expect(nav.className).toContain("h-full");
    expect(nav.className).toContain("transition-[width]");
    const home = screen.getByRole("link", { name: "Dealflow home" });
    expect(home.getAttribute("href")).toBe("/");
    const logo = screen.getByRole("img", { name: "Dealflow" });
    expect(logo.getAttribute("src")).toBe("/brand/dealflow-logo-horizontal-reverse.svg");
    expect(logo.getAttribute("height")).toBe("24");
    // The label is on screen, and the link still keeps its accessible name.
    const pipeline = screen.getByRole("link", { name: "Pipeline" });
    expect(pipeline.textContent).toBe("Pipeline");
    expect(pipeline.querySelector("svg")).not.toBeNull();
  });

  test("collapses to the 56 px icon rail and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<LeftNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const toggle = screen.getByTestId("rail-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe("app-nav");
    expect(toggle.textContent).toBe("Collapse");

    await user.click(toggle);
    expect(nav.getAttribute("data-state")).toBe("collapsed");
    expect(nav.className).toContain("w-14");
    expect(screen.getByRole("link", { name: "Pipeline" }).textContent).toBe("");
    const mark = screen.getByRole("img", { name: "Dealflow" });
    expect(mark.getAttribute("src")).toBe("/brand/dealflow-mark-reverse.svg");
    expect(mark.getAttribute("height")).toBe("28");
    const collapsedToggle = screen.getByTestId("rail-toggle");
    expect(collapsedToggle.getAttribute("aria-expanded")).toBe("false");
    expect(collapsedToggle.getAttribute("aria-label")).toBe("Expand sidebar");
    expect(document.cookie).toContain("wd_rail=collapsed");
  });

  test("respects the server-provided initial state", () => {
    render(<LeftNav initialRail="collapsed" />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.getAttribute("data-state")).toBe("collapsed");
    expect(nav.className).toContain("w-14");
  });

  test("marks the active section violet with aria-current", () => {
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
});
