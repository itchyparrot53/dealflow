import { describe, expect, test } from "vitest";
import { decideWipe } from "./wipe";

// The IndexedDB calls are deliberately not exercised here (fake-indexeddb is not installed); this
// covers the user-change rule that decides whether a wipe happens at all.
describe("decideWipe", () => {
  test("a fresh browser records the first user without wiping", () => {
    expect(decideWipe(null, "user-a")).toBe("record");
  });

  test("the same user keeps their records", () => {
    expect(decideWipe("user-a", "user-a")).toBe("keep");
  });

  test("a different user wipes first", () => {
    expect(decideWipe("user-a", "user-b")).toBe("wipe");
  });

  test("signing out wipes", () => {
    expect(decideWipe("user-a", null)).toBe("wipe");
  });

  test("no previous and no current user keeps", () => {
    expect(decideWipe(null, null)).toBe("keep");
  });
});
