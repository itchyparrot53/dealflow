import { describe, expect, test } from "vitest";
import { CONSENT_SOURCES, MARKETING_STATUSES } from "@/constants/marketing";
import {
  allowedTargets,
  impliedBasis,
  isTransitionAllowed,
  requiresBasis,
  statusAfterBounce,
} from "./status";

// The 6.2 table written out independently of the implementation: the test is the contract.
const ALLOWED: Record<string, readonly string[]> = {
  "not_subscribed>pending": ["form", "manual", "bulk"],
  "not_subscribed>subscribed": ["manual", "bulk", "import", "form", "double_opt_in"],
  "pending>subscribed": ["double_opt_in"],
  "pending>not_subscribed": ["manual", "bulk", "system"],
  "subscribed>unsubscribed": [
    "unsubscribe_link",
    "one_click",
    "preference_page",
    "manual",
    "bulk",
    "complaint",
  ],
  "pending>unsubscribed": [
    "unsubscribe_link",
    "one_click",
    "preference_page",
    "manual",
    "bulk",
    "complaint",
  ],
  "subscribed>bounced": ["bounce"],
  "pending>bounced": ["bounce"],
  "unsubscribed>pending": ["form", "preference_page", "manual"],
  "bounced>pending": ["form", "preference_page", "manual"],
  "unsubscribed>subscribed": ["double_opt_in"],
  "bounced>subscribed": ["double_opt_in"],
};

describe("marketing status machine", () => {
  test("allows exactly the transitions in the 6.2 table, for every source", () => {
    for (const from of MARKETING_STATUSES) {
      for (const to of MARKETING_STATUSES) {
        const allowedSources = ALLOWED[`${from}>${to}`] ?? [];
        for (const source of CONSENT_SOURCES) {
          expect(isTransitionAllowed(from, to, source), `${from} -> ${to} via ${source}`).toBe(
            allowedSources.includes(source),
          );
        }
      }
    }
  });

  test("a direct subscribe needs a basis, double opt-in and forms do not", () => {
    expect(requiresBasis("not_subscribed", "subscribed", "manual")).toBe(true);
    expect(requiresBasis("not_subscribed", "subscribed", "bulk")).toBe(true);
    expect(requiresBasis("not_subscribed", "subscribed", "import")).toBe(true);
    expect(requiresBasis("not_subscribed", "subscribed", "double_opt_in")).toBe(false);
    expect(requiresBasis("not_subscribed", "subscribed", "form")).toBe(false);
    expect(requiresBasis("pending", "subscribed", "double_opt_in")).toBe(false);
    expect(requiresBasis("not_subscribed", "pending", "manual")).toBe(false);
  });

  test("the dialog targets never include an unavailable status", () => {
    expect(
      allowedTargets("subscribed")
        .map((t) => t.to)
        .sort(),
    ).toEqual(["bounced", "unsubscribed"]);
    expect(
      allowedTargets("bounced")
        .map((t) => t.to)
        .sort(),
    ).toEqual(["pending", "subscribed"]);
    expect(
      allowedTargets("not_subscribed")
        .map((t) => t.to)
        .sort(),
    ).toEqual(["pending", "subscribed"]);
  });

  test("the flow supplies the basis it proves", () => {
    expect(impliedBasis("subscribed", "double_opt_in")).toBe("double_opt_in");
    expect(impliedBasis("subscribed", "form")).toBe("form_consent");
    expect(impliedBasis("subscribed", "manual")).toBeNull();
    expect(impliedBasis("unsubscribed", "double_opt_in")).toBeNull();
  });

  test("hard bounces bounce at once, the third soft bounce does", () => {
    expect(statusAfterBounce("hard", 0)).toBe("bounced");
    expect(statusAfterBounce("soft", 0)).toBeNull();
    expect(statusAfterBounce("soft", 1)).toBeNull();
    expect(statusAfterBounce("soft", 2)).toBe("bounced");
  });
});
