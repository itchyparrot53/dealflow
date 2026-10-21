import { describe, expect, it } from "vitest";
import { newWebhookSecret, signatureHeader, signPayload, verifySignature } from "./signature";

// Secret, timestamp and body from 6.6. The expected hex is computed once with node:crypto and
// pinned here, so a change to the signing input (for example dropping the timestamp from the
// MAC) fails loudly instead of agreeing with itself.
const SECRET = "whsec_test";
const TIMESTAMP = 1_700_000_000;
const BODY = '{"a":1}';
const EXPECTED = "38877139021993b830af32feea6e18a8da83eb2f6e49ee50bd9e4cf4ca4d3789";

describe("signPayload", () => {
  it("matches the pinned HMAC-SHA256 vector", () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).toBe(EXPECTED);
  });

  it("formats the header as t=<timestamp>,v1=<hex>", () => {
    expect(signatureHeader(SECRET, TIMESTAMP, BODY)).toBe(`t=${TIMESTAMP},v1=${EXPECTED}`);
  });
});

describe("verifySignature", () => {
  it("accepts a fresh, correct signature", () => {
    const header = signatureHeader(SECRET, TIMESTAMP, BODY);
    expect(verifySignature(SECRET, header, BODY, TIMESTAMP)).toBe(true);
    expect(verifySignature(SECRET, header, BODY, TIMESTAMP + 299)).toBe(true);
  });

  it("rejects a stale timestamp", () => {
    const header = signatureHeader(SECRET, TIMESTAMP, BODY);
    expect(verifySignature(SECRET, header, BODY, TIMESTAMP + 301)).toBe(false);
    expect(verifySignature(SECRET, header, BODY, TIMESTAMP - 301)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const header = signatureHeader(SECRET, TIMESTAMP, BODY);
    expect(verifySignature(SECRET, header, '{"a":2}', TIMESTAMP)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const header = signatureHeader(SECRET, TIMESTAMP, BODY);
    expect(verifySignature("whsec_other", header, BODY, TIMESTAMP)).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(verifySignature(SECRET, "", BODY, TIMESTAMP)).toBe(false);
    expect(verifySignature(SECRET, `t=${TIMESTAMP}`, BODY, TIMESTAMP)).toBe(false);
    expect(verifySignature(SECRET, "v1=abc", BODY, TIMESTAMP)).toBe(false);
    expect(verifySignature(SECRET, `t=nope,v1=${EXPECTED}`, BODY, TIMESTAMP)).toBe(false);
    expect(verifySignature(SECRET, `t=${TIMESTAMP},v1=zzzz`, BODY, TIMESTAMP)).toBe(false);
  });
});

describe("newWebhookSecret", () => {
  it("has the whsec_ prefix and a random body", () => {
    const first = newWebhookSecret();
    const second = newWebhookSecret();
    expect(first.startsWith("whsec_")).toBe(true);
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(20);
  });
});
