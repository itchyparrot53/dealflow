import { describe, expect, it } from "vitest";
import { API_TOKEN_PREFIX } from "@/constants/projectsApi";
import { hashApiToken, newApiToken, parseBearer } from "./tokenFormat";

describe("newApiToken", () => {
  it("creates a prefixed base64url token with a hash and a 12-character prefix", () => {
    const created = newApiToken();
    expect(created.token.startsWith(API_TOKEN_PREFIX)).toBe(true);
    // 32 random bytes in base64url without padding is 43 characters.
    expect(created.token).toMatch(/^dfk_[A-Za-z0-9_-]{43}$/);
    expect(created.prefix).toBe(created.token.slice(0, 12));
    expect(created.prefix).toHaveLength(12);
    expect(created.hash).toBe(hashApiToken(created.token));
  });

  it("stores only a SHA-256 hex digest, never the token itself", () => {
    const created = newApiToken();
    expect(created.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(created.hash).not.toContain(created.token);
    expect(hashApiToken(created.token)).toBe(created.hash);
  });

  it("produces a fresh token on every call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => newApiToken().token));
    expect(tokens.size).toBe(20);
  });
});

describe("hashApiToken", () => {
  it("is stable and differs for different tokens", () => {
    expect(hashApiToken("dfk_abc")).toBe(hashApiToken("dfk_abc"));
    expect(hashApiToken("dfk_abc")).not.toBe(hashApiToken("dfk_abd"));
  });
});

describe("parseBearer", () => {
  it("accepts a single-space bearer header with any scheme case", () => {
    expect(parseBearer("Bearer dfk_abc")).toBe("dfk_abc");
    expect(parseBearer("bearer dfk_abc")).toBe("dfk_abc");
    expect(parseBearer("BEARER dfk_abc")).toBe("dfk_abc");
    expect(parseBearer("Bearer dfk_A-b_9")).toBe("dfk_A-b_9");
  });

  it("rejects a missing header, another scheme, a missing prefix and bad spacing", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Basic dfk_abc")).toBeNull();
    expect(parseBearer("Token dfk_abc")).toBeNull();
    expect(parseBearer("Bearer")).toBeNull();
    expect(parseBearer("Bearer ")).toBeNull();
    expect(parseBearer("Bearer abc")).toBeNull();
    expect(parseBearer("Bearer  dfk_abc")).toBeNull();
    expect(parseBearer("Bearer dfk_abc ")).toBeNull();
    expect(parseBearer("Bearer dfk_abc, dfk_def")).toBeNull();
  });
});
