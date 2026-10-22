// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Kbd } from "./kbd";

it("renders a keyboard hint at the 20 px scale", () => {
  render(<Kbd>Cmd K</Kbd>);
  const kbd = screen.getByText("Cmd K");
  expect(kbd.tagName).toBe("KBD");
  expect(kbd.className).toContain("h-5");
  expect(kbd.className).toContain("rounded-md");
  expect(kbd.className).toContain("bg-muted");
});
