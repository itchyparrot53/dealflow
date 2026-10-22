// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

afterEach(cleanup);

it("renders the only all-caps badge surface at 12/700", () => {
  render(<StatusBadge tone="overdue">Overdue</StatusBadge>);
  const badge = screen.getByText("Overdue");
  expect(badge.className).toContain("uppercase");
  expect(badge.className).toContain("text-xs");
  expect(badge.className).toContain("font-bold");
  expect(badge.className).toContain("h-5");
  expect(badge.className).toContain("rounded-full");
});

it("outlines a plan tag instead of filling it", () => {
  render(<StatusBadge tone="plan">Team</StatusBadge>);
  const badge = screen.getByText("Team");
  expect(badge.className).toContain("rounded-md");
  expect(badge.className).toContain("border-badge-plan-border");
  expect(badge.className).not.toContain("rounded-full");
});
