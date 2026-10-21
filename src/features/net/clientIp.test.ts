import { describe, expect, it } from "vitest";
import { clientIp } from "./clientIp";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("clientIp", () => {
  it("ignores x-forwarded-for entirely when no proxy is trusted", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "203.0.113.9" });
    expect(clientIp(h, 0)).toBe("203.0.113.9");
  });

  it("falls back to unknown at hops 0 when no x-real-ip is present", () => {
    expect(clientIp(headers({ "x-forwarded-for": "6.6.6.6" }), 0)).toBe("unknown");
  });

  it("takes the entry one place from the right at hops 1, ignoring a spoofed left entry", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIp(h, 1)).toBe("203.0.113.9");
  });

  it("takes the entry two places from the right at hops 2", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 198.51.100.7" });
    expect(clientIp(h, 2)).toBe("203.0.113.9");
  });

  it("falls back to the leftmost entry when the list is shorter than the hop count", () => {
    const h = headers({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" });
    expect(clientIp(h, 5)).toBe("203.0.113.9");
  });

  it("trims whitespace and ignores empty entries", () => {
    const h = headers({ "x-forwarded-for": "  6.6.6.6 ,  , 203.0.113.9  " });
    expect(clientIp(h, 1)).toBe("203.0.113.9");
  });

  it("uses x-real-ip when x-forwarded-for is absent", () => {
    expect(clientIp(headers({ "x-real-ip": "203.0.113.9" }), 1)).toBe("203.0.113.9");
  });

  it("returns unknown when neither header is present", () => {
    expect(clientIp(headers({}), 1)).toBe("unknown");
  });

  it("defaults to one trusted hop", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIp(h)).toBe("203.0.113.9");
  });
});
