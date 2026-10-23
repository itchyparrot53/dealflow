import { describe, expect, it } from "vitest";
import { isStaleWithoutActivity, NO_ACTIVITY_WARNING_DAYS } from "./noActivityAge";

const now = new Date("2026-07-03T12:00:00.000Z");
const daysAgo = (days: number): Date => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("isStaleWithoutActivity", () => {
  it("is neutral before the warning window has passed since creation", () => {
    expect(isStaleWithoutActivity({ createdAt: daysAgo(13), lastActivityAt: null }, now)).toBe(
      false,
    );
  });

  it("warns once the lead has been quiet for 14 days since creation", () => {
    expect(isStaleWithoutActivity({ createdAt: daysAgo(14), lastActivityAt: null }, now)).toBe(
      true,
    );
  });

  it("measures from the last activity when there is one", () => {
    expect(
      isStaleWithoutActivity({ createdAt: daysAgo(60), lastActivityAt: daysAgo(2) }, now),
    ).toBe(false);
    expect(
      isStaleWithoutActivity({ createdAt: daysAgo(60), lastActivityAt: daysAgo(30) }, now),
    ).toBe(true);
  });

  it("accepts ISO strings", () => {
    expect(
      isStaleWithoutActivity(
        { createdAt: "2026-06-01T12:00:00.000Z", lastActivityAt: undefined },
        now,
      ),
    ).toBe(true);
  });

  it("uses the documented two-week threshold", () => {
    expect(NO_ACTIVITY_WARNING_DAYS).toBe(14);
  });
});
