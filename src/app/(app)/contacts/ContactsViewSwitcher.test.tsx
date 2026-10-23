// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ContactsViewSwitcher } from "./ContactsViewSwitcher";

afterEach(cleanup);

it("links the three contacts sections and marks the current one", () => {
  render(<ContactsViewSwitcher value="orgs" />);
  expect(screen.getByRole("group", { name: "Contacts view" })).toBeInTheDocument();
  const people = screen.getByRole("link", { name: "People" });
  expect(people).toHaveAttribute("href", "/contacts/people");
  const orgs = screen.getByRole("link", { name: "Organizations" });
  expect(orgs).toHaveAttribute("href", "/contacts/orgs");
  const timeline = screen.getByRole("link", { name: "Timeline" });
  expect(timeline).toHaveAttribute("href", "/contacts/timeline");
  expect(orgs).toHaveAttribute("aria-current", "page");
  expect(people).not.toHaveAttribute("aria-current");
  expect(timeline).not.toHaveAttribute("aria-current");
});

it("marks the timeline view for the timeline page", () => {
  render(<ContactsViewSwitcher value="timeline" />);
  expect(screen.getByRole("link", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
});
