import { describe, expect, test } from "vitest";
import { createSequenceMatcher } from "./sequences";

const MAP = { "g d": "go.deals", "g p": "go.people", "n d": "new.deal" };

describe("createSequenceMatcher", () => {
  test("matches g then d within 1200 ms", () => {
    const matcher = createSequenceMatcher(MAP, 1_200);
    expect(matcher.press("g", 1_000)).toBeNull();
    expect(matcher.press("d", 1_100)).toBe("go.deals");
  });

  test("does not match after 1300 ms", () => {
    const matcher = createSequenceMatcher(MAP, 1_200);
    matcher.press("g", 1_000);
    expect(matcher.press("d", 2_300)).toBeNull();
  });

  test("a modifier resets the sequence", () => {
    const matcher = createSequenceMatcher(MAP, 1_200);
    matcher.press("g", 1_000);
    expect(matcher.press("Shift", 1_100)).toBeNull();
    expect(matcher.press("d", 1_200)).toBeNull();
  });

  test("reset clears the pending prefix", () => {
    const matcher = createSequenceMatcher(MAP, 1_200);
    matcher.press("g", 1_000);
    matcher.reset();
    expect(matcher.press("d", 1_050)).toBeNull();
  });

  test("unrelated keys clear the prefix", () => {
    const matcher = createSequenceMatcher(MAP, 1_200);
    matcher.press("g", 1_000);
    expect(matcher.press("x", 1_050)).toBeNull();
    expect(matcher.press("d", 1_060)).toBeNull();
  });

  test("a second sequence works after the first", () => {
    const matcher = createSequenceMatcher(MAP, 1_200);
    matcher.press("g", 1_000);
    expect(matcher.press("d", 1_100)).toBe("go.deals");
    matcher.press("n", 2_000);
    expect(matcher.press("d", 2_050)).toBe("new.deal");
  });
});
