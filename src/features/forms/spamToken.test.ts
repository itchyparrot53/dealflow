import { describe, expect, it } from "vitest";
import { FORM_MIN_FILL_MS, FORM_TOKEN_MAX_AGE_MS } from "@/constants/formsBooking";
import { checkFormToken, issueFormToken } from "./spamToken";

const FORM = "public-form-id";
const NOW = 1_800_000_000_000;

describe("form spam token", () => {
  it("accepts a token after the minimum fill time", () => {
    const token = issueFormToken(FORM, NOW);
    expect(checkFormToken(FORM, token, NOW + FORM_MIN_FILL_MS)).toBe("ok");
  });

  it("flags a token issued under the minimum fill time", () => {
    const token = issueFormToken(FORM, NOW);
    expect(checkFormToken(FORM, token, NOW + FORM_MIN_FILL_MS - 1)).toBe("too_fast");
  });

  it("rejects a tampered signature", () => {
    const token = issueFormToken(FORM, NOW);
    const [issued = "", signature = ""] = token.split(".");
    const flipped = signature.endsWith("0") ? "1" : "0";
    expect(checkFormToken(FORM, `${issued}.${signature.slice(0, -1)}${flipped}`, NOW + 5000)).toBe(
      "invalid",
    );
  });

  it("rejects a token minted for another form", () => {
    const token = issueFormToken(FORM, NOW);
    expect(checkFormToken("another-form", token, NOW + 5000)).toBe("invalid");
  });

  it("rejects an expired token", () => {
    const token = issueFormToken(FORM, NOW);
    expect(checkFormToken(FORM, token, NOW + FORM_TOKEN_MAX_AGE_MS + 1)).toBe("invalid");
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "now", "abc.def", `${NOW}.`, `.${"a".repeat(64)}`, "1.2.3"]) {
      expect(checkFormToken(FORM, token, NOW)).toBe("invalid");
    }
  });

  it("rejects a token whose timestamp is in the future", () => {
    const token = issueFormToken(FORM, NOW + 60_000);
    expect(checkFormToken(FORM, token, NOW)).toBe("invalid");
  });
});
