import { describe, expect, it } from "vitest";
import { sanitizeUserProjectInput } from "./fromDeal";

describe("sanitizeUserProjectInput", () => {
  it("removes the automation-only allowAnyStatus flag", () => {
    expect(
      sanitizeUserProjectInput({ name: "Mine", allowAnyStatus: true, phases: ["Kickoff"] }),
    ).toEqual({ name: "Mine", phases: ["Kickoff"] });
  });

  it("passes non-objects through untouched", () => {
    expect(sanitizeUserProjectInput(null)).toBeNull();
    expect(sanitizeUserProjectInput("input")).toBe("input");
  });
});
