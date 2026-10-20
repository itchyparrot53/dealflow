import { describe, expect, it } from "vitest";
import { formatDocNumber } from "./numbering";

describe("formatDocNumber", () => {
  it("pads the sequence to four digits", () => {
    expect(formatDocNumber("INV", 2026, 7)).toBe("INV-2026-0007");
    expect(formatDocNumber("Q", 2026, 1)).toBe("Q-2026-0001");
  });

  it("keeps four digits at the boundary", () => {
    expect(formatDocNumber("INV", 2026, 9999)).toBe("INV-2026-9999");
  });

  it("grows past four digits instead of truncating", () => {
    expect(formatDocNumber("INV", 2026, 10000)).toBe("INV-2026-10000");
    expect(formatDocNumber("INV", 2026, 12345)).toBe("INV-2026-12345");
  });
});
