import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

const cursor = {
  updatedAt: "2026-10-21T10:15:30.000Z",
  id: "0b7c1f3e-2a4d-4c6b-8e9f-1a2b3c4d5e6f",
};

describe("cursor", () => {
  it("round trips updatedAt and id through base64url JSON", () => {
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ ok: true, value: cursor });
  });

  it("encodes the same cursor to the same string", () => {
    expect(encodeCursor(cursor)).toBe(encodeCursor(cursor));
  });

  it("rejects junk, non-JSON and the wrong shape", () => {
    for (const bad of [
      "",
      "not a cursor",
      "!!!",
      Buffer.from("[]", "utf8").toString("base64url"),
      Buffer.from('"text"', "utf8").toString("base64url"),
      Buffer.from('{"updatedAt":"2026-10-21T10:15:30.000Z"}', "utf8").toString("base64url"),
      Buffer.from('{"id":"abc"}', "utf8").toString("base64url"),
      Buffer.from('{"updatedAt":"nope","id":"abc"}', "utf8").toString("base64url"),
      Buffer.from('{"updatedAt":1,"id":"abc"}', "utf8").toString("base64url"),
    ]) {
      expect(decodeCursor(bad).ok, bad).toBe(false);
    }
  });
});
