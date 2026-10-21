import { describe, expect, test } from "vitest";
import { rescheduledIso } from "./bulk";

describe("rescheduledIso", () => {
  test("moves the date and keeps the time of day", () => {
    expect(rescheduledIso("2026-07-15T14:30:00.000Z", "2026-07-20", false)).toBe(
      "2026-07-20T14:30:00.000Z",
    );
  });

  test("an all-day activity lands on local midnight", () => {
    expect(rescheduledIso("2026-07-15T00:00:00.000Z", "2026-07-20", true)).toBe(
      "2026-07-20T00:00:00.000Z",
    );
  });

  test("a missing due date lands on local midnight", () => {
    expect(rescheduledIso(null, "2026-07-20", false)).toBe("2026-07-20T00:00:00.000Z");
  });
});
