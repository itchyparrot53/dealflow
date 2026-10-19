import { describe, expect, it } from "vitest";
import { isSameOriginPost } from "./originCheck";

// vitest.setup.ts sets BASE_URL=https://app.example.com and NODE_ENV=test, so the loopback
// exception is live here exactly as it is under `next dev`.
const headers = (init: Record<string, string>): Headers => new Headers(init);

describe("isSameOriginPost", () => {
  it("accepts the BASE_URL origin", () => {
    expect(isSameOriginPost(headers({ origin: "https://app.example.com" }))).toBe(true);
  });

  it("rejects another origin", () => {
    expect(isSameOriginPost(headers({ origin: "https://evil.example" }))).toBe(false);
  });

  it("rejects a cross-site fetch even with no origin", () => {
    expect(isSameOriginPost(headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("accepts a missing origin when the browser says same-origin", () => {
    expect(isSameOriginPost(headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rejects a request with neither origin nor fetch-site", () => {
    expect(isSameOriginPost(headers({}))).toBe(false);
  });

  it("accepts a loopback origin that matches the host outside production", () => {
    expect(
      isSameOriginPost(headers({ origin: "http://localhost:3001", host: "localhost:3001" })),
    ).toBe(true);
  });
});
