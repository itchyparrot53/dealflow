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

describe("shortcut registry", () => {
  test("every documented sequence has a route and a help entry", async () => {
    const { SHORTCUT_SEQUENCES, SEQUENCE_MAP, SHORTCUT_HELP_GROUPS } = await import("./registry");
    expect(Object.keys(SEQUENCE_MAP)).toHaveLength(SHORTCUT_SEQUENCES.length);
    const documented = SHORTCUT_HELP_GROUPS.flatMap((group) =>
      group.items.map((item) => item.keys),
    );
    for (const sequence of SHORTCUT_SEQUENCES) {
      expect(sequence.href.startsWith("/")).toBe(true);
      expect(documented).toContain(sequence.keys);
    }
    expect(documented).toContain("?");
    expect(documented).toContain("Cmd/Ctrl+K");
  });
});
