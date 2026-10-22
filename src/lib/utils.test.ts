import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  // text-title is a project font size, not one tailwind-merge ships with. Left unregistered it
  // reads as a text COLOUR, so a later text-foreground wins and the size vanishes with no error.
  it("keeps the record-title size when a colour follows it", () => {
    expect(cn("text-title font-semibold text-foreground")).toContain("text-title");
  });

  it("lets the record-title size override an earlier size", () => {
    const merged = cn("text-sm", "text-title");
    expect(merged).toContain("text-title");
    expect(merged).not.toContain("text-sm");
  });

  it("still resolves a stock size conflict", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });
});
