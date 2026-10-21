import { describe, expect, test } from "vitest";
import {
  domainOf,
  normalizeEmail,
  normalizeOrgName,
  normalizePersonName,
  normalizePhone,
  phoneKey,
} from "./normalize";

describe("normalize", () => {
  test("lower-cases and trims an email", () => {
    expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });

  test("keeps digits only and rejects short numbers", () => {
    expect(normalizePhone("+1 (555) 123-4567")).toBe("15551234567");
    expect(normalizePhone("12345")).toBeNull();
  });

  test("phone keys match the last nine digits across formatting", () => {
    expect(phoneKey("+1 (555) 123-4567")).toBe(phoneKey("555.123.4567"));
    expect(phoneKey("12345")).toBeNull();
  });

  test("person names fold diacritics and collapse spaces", () => {
    expect(normalizePersonName("  Café   Noir ")).toBe("cafe noir");
    expect(normalizePersonName("CAFÉ NOIR")).toBe(normalizePersonName("cafe noir"));
  });

  test("organization names drop punctuation and legal suffixes", () => {
    expect(normalizeOrgName("Acme Ltd.")).toBe(normalizeOrgName("ACME Limited"));
    expect(normalizeOrgName("Acme Ltd.")).toBe("acme");
    expect(normalizeOrgName("Café Noir GmbH")).toBe("cafe noir");
  });

  test("domains drop the scheme, www and path", () => {
    expect(domainOf("www.acme.com/path")).toBe("acme.com");
    expect(domainOf("https://www.acme.com/path?q=1")).toBe("acme.com");
    expect(domainOf("acme.com")).toBe("acme.com");
    expect(domainOf("not a domain")).toBeNull();
    expect(domainOf("")).toBeNull();
  });
});
