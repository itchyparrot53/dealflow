// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc-client", () => ({
  trpc: { ai: { status: { useQuery: () => ({ data: { available: true } }) } } },
}));
vi.mock("@/features/ai/actions/filterActions", () => ({
  describeFilterAction: vi.fn(() =>
    Promise.resolve({ ok: true, value: { definition: {}, explanation: "x" } }),
  ),
}));

import { AiFilterButton } from "./AiFilterButton";

afterEach(cleanup);

it("keeps the field behind an Ask AI popover", async () => {
  const user = userEvent.setup();
  render(<AiFilterButton entity="lead" onDefinition={() => {}} />);
  expect(screen.queryByLabelText("Describe a filter")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Ask AI" });
  expect(trigger).toBeInTheDocument();
  await user.click(trigger);
  const field = await screen.findByLabelText("Describe a filter");
  expect(field.tagName).toBe("TEXTAREA");
  // The entity decides the example, so Leads no longer talks about deals.
  expect(field).toHaveAttribute("placeholder", "Leads from web forms with no activity");
  expect(screen.getByRole("button", { name: "Generate filter" })).toBeInTheDocument();
});

it("offers the deals example for the pipeline modal path", () => {
  render(<AiFilterButton entity="deal" onDefinition={() => {}} />);
  expect(screen.getByRole("button", { name: "Ask AI" })).toBeInTheDocument();
});
