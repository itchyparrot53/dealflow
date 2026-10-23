// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerFooter } from "./ComposerFooter";

afterEach(cleanup);

function props() {
  return {
    canSend: true,
    sending: false,
    onSend: vi.fn(),
    onDiscard: vi.fn(),
    trackOpens: false,
    onTrackOpensChange: vi.fn(),
    trackLinks: false,
    onTrackLinksChange: vi.fn(),
    layout: "branded" as const,
    onLayoutChange: vi.fn(),
    onPreview: vi.fn(),
  };
}

describe("ComposerFooter layout and preview", () => {
  it("shows the resolved layout and opens the preview", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ComposerFooter {...p} />);
    expect(screen.getByRole("button", { name: "Layout" })).toHaveTextContent("Branded");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(p.onPreview).toHaveBeenCalledTimes(1);
  });

  it("offers Branded, Minimal and Plain in the layout menu", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ComposerFooter {...p} />);
    await user.click(screen.getByRole("button", { name: "Layout" }));
    expect(await screen.findByRole("menuitem", { name: "Minimal" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Plain" }));
    expect(p.onLayoutChange).toHaveBeenCalledWith("plain");
  });
});
