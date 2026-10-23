// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  normalizeRailState,
  RAIL_COOKIE,
  railCookie,
  railStateToggle,
  writeRailState,
} from "./railState";

describe("normalizeRailState", () => {
  it("defaults to expanded when the cookie is missing or invalid", () => {
    expect(normalizeRailState(undefined)).toBe("expanded");
    expect(normalizeRailState(null)).toBe("expanded");
    expect(normalizeRailState("")).toBe("expanded");
    expect(normalizeRailState("garbage")).toBe("expanded");
  });

  it("keeps the two valid states", () => {
    expect(normalizeRailState("expanded")).toBe("expanded");
    expect(normalizeRailState("collapsed")).toBe("collapsed");
  });
});

describe("railStateToggle", () => {
  it("flips both ways", () => {
    expect(railStateToggle("expanded")).toBe("collapsed");
    expect(railStateToggle("collapsed")).toBe("expanded");
  });
});

describe("the rail cookie", () => {
  it("is a one-year, site-wide, SameSite=Lax cookie", () => {
    const value = railCookie("collapsed");
    expect(value).toContain(`${RAIL_COOKIE}=collapsed`);
    expect(value).toContain("path=/");
    expect(value).toContain("max-age=31536000");
    expect(value).toContain("SameSite=Lax");
  });

  it("writes the current state to the document", () => {
    writeRailState("collapsed");
    expect(document.cookie).toContain(`${RAIL_COOKIE}=collapsed`);
    writeRailState("expanded");
    expect(document.cookie).toContain(`${RAIL_COOKIE}=expanded`);
  });
});
