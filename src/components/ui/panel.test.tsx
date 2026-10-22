// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Panel } from "./panel";

afterEach(cleanup);

it("renders a 48 px header with its title and actions above a padded body", () => {
  render(
    <Panel title="Deal details" actions={<button type="button">Edit</button>}>
      <p>Body</p>
    </Panel>,
  );
  const title = screen.getByRole("heading", { level: 2, name: "Deal details" });
  expect(title.className).toContain("text-base");
  expect(title.closest("header")?.className).toContain("h-12");
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(screen.getByText("Body").parentElement?.className).toContain("p-4");
});

it("can omit the body padding for an edge-to-edge table", () => {
  render(
    <Panel padded={false}>
      <table />
    </Panel>,
  );
  expect(screen.getByRole("table").parentElement?.className ?? "").not.toContain("p-4");
});
