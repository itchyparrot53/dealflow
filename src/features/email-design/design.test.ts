import { describe, expect, it } from "vitest";
import { assertAccentColor } from "./design";

describe("assertAccentColor", () => {
  it("accepts the default accent, which keeps white button text readable", () => {
    const result = assertAccentColor("#2D8548");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects a pale accent with the measured ratio in the message", () => {
    const result = assertAccentColor("#9BE7B3");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.id).toBe("E_EMAIL_DESIGN_004");
      expect(result.error.message).toContain("4.5:1");
    }
  });

  it("rejects a value that is not a hex colour", () => {
    const result = assertAccentColor("green");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe("E_EMAIL_DESIGN_006");
  });
});
