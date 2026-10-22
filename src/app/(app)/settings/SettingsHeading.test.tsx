// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsHeading } from "./SettingsHeading";

afterEach(cleanup);

describe("SettingsHeading", () => {
  it("renders the section heading at the measured size (the page title lives in the top bar)", () => {
    render(<SettingsHeading title="Users" description="Who can sign in" />);
    // No breadcrumb or second 24 px title: the top bar owns the page name now.
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    const heading = screen.getByRole("heading", { level: 2, name: "Users" });
    expect(heading.className).toContain("text-base");
    expect(heading.className).toContain("font-semibold");
    expect(screen.getByText("Who can sign in")).not.toBeNull();
  });
});
