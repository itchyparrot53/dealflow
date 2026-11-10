import { describe, expect, test } from "vitest";
import {
  ADMIN_DEFAULT_FLAGS,
  ALL_PERMISSION_FLAG_KEYS,
  HIGH_RISK_FLAGS,
  REGULAR_DEFAULT_FLAGS,
} from "./permissionFlags";

describe("permission flags", () => {
  test("includes ownership pairs as _own/_any keys", () => {
    expect(ALL_PERMISSION_FLAG_KEYS).toContain("deal.edit_own");
    expect(ALL_PERMISSION_FLAG_KEYS).toContain("deal.edit_any");
    expect(ALL_PERMISSION_FLAG_KEYS).toContain("record.share_own");
    expect(ALL_PERMISSION_FLAG_KEYS).toContain("record.share_any");
  });

  test("admin defaults grant every key", () => {
    for (const key of ALL_PERMISSION_FLAG_KEYS) {
      expect(ADMIN_DEFAULT_FLAGS[key], `admin missing ${key}`).toBe(true);
    }
  });

  test("regular defaults: create yes, delete no, own-edit yes, any-edit no", () => {
    expect(REGULAR_DEFAULT_FLAGS["deal.create"]).toBe(true);
    expect(REGULAR_DEFAULT_FLAGS["deal.edit_own"]).toBe(true);
    expect(REGULAR_DEFAULT_FLAGS["deal.edit_any"]).toBe(false);
    expect(REGULAR_DEFAULT_FLAGS["deal.delete_own"]).toBe(false);
  });

  test("campaign flags exist and follow the 6.1 defaults", () => {
    for (const key of [
      "campaigns.view",
      "campaigns.edit",
      "campaigns.send",
      "marketing.manage",
    ] as const) {
      expect(ALL_PERMISSION_FLAG_KEYS).toContain(key);
      expect(ADMIN_DEFAULT_FLAGS[key], `admin missing ${key}`).toBe(true);
    }
    expect(REGULAR_DEFAULT_FLAGS["campaigns.view"]).toBe(true);
    expect(REGULAR_DEFAULT_FLAGS["campaigns.edit"]).toBe(false);
    expect(REGULAR_DEFAULT_FLAGS["campaigns.send"]).toBe(false);
    expect(REGULAR_DEFAULT_FLAGS["marketing.manage"]).toBe(false);
  });

  test("high-risk flags are a subset of all keys", () => {
    for (const key of HIGH_RISK_FLAGS) expect(ALL_PERMISSION_FLAG_KEYS).toContain(key);
  });
});
