import { describe, expect, test } from "vitest";
import { decide } from "./routes";

const ORIGIN = "https://crm.example.com";

function req(path: string, patch: Partial<{ url: string; method: string; mode: string }> = {}) {
  return {
    url: `${ORIGIN}${path}`,
    method: "GET",
    mode: "cors",
    origin: ORIGIN,
    ...patch,
  };
}

describe("decide", () => {
  test("every non-GET request bypasses", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      expect(decide(req("/deals", { method }))).toEqual({ kind: "bypass" });
    }
  });

  test("a different origin bypasses", () => {
    expect(decide({ ...req("/deals"), url: "https://other.example/deals" })).toEqual({
      kind: "bypass",
    });
  });

  test("every bypass prefix bypasses", () => {
    const paths = [
      "/api/",
      "/api/v1/deals",
      "/_ws",
      "/trpc",
      "/trpc/deal.list",
      "/t/abc",
      "/d/abc",
      "/f/abc",
      "/book/abc",
      "/auth/abc",
      "/oauth/abc",
      "/export/deals",
      "/insights/reports/1/export.csv",
    ];
    for (const path of paths) {
      expect(decide(req(path)), path).toEqual({ kind: "bypass" });
    }
  });

  test("static paths are cache-first", () => {
    for (const path of [
      "/_next/static/chunks/app.js",
      "/icons/icon-192.png",
      "/brand/dealflow-logo-horizontal-colour.svg",
      "/fonts/inter.woff2",
      "/manifest.webmanifest",
    ]) {
      expect(decide(req(path)), path).toEqual({ kind: "cache-first" });
    }
  });

  test("a navigation falls back to /offline", () => {
    expect(decide(req("/deals", { mode: "navigate" }))).toEqual({ kind: "navigate-fallback" });
  });

  test("everything else bypasses", () => {
    expect(decide(req("/deals"))).toEqual({ kind: "bypass" });
    expect(decide(req("/_next/image"))).toEqual({ kind: "bypass" });
    expect(decide({ ...req("/deals"), url: "not a url" })).toEqual({ kind: "bypass" });
  });
});
