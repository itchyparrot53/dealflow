import { describe, expect, it } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { checkWebhookUrl, isBlockedAddress } from "./ipRanges";

// One blocked address and one allowed neighbour per IPv4 range of 6.6. The neighbour is the
// first address just outside the block, so an off-by-one mask bug fails the test.
const IPV4_RANGES: [blocked: string, allowed: string][] = [
  ["0.0.0.0", "1.0.0.0"],
  ["10.0.0.0", "11.0.0.0"],
  ["100.64.0.0", "100.128.0.0"],
  ["127.0.0.0", "128.0.0.0"],
  ["169.254.0.0", "169.255.0.0"],
  ["172.16.0.0", "172.32.0.0"],
  ["192.0.0.0", "192.0.1.0"],
  ["192.0.2.0", "192.0.3.0"],
  ["192.168.0.0", "192.169.0.0"],
  ["198.18.0.0", "198.20.0.0"],
  ["198.51.100.0", "198.51.101.0"],
  ["203.0.113.0", "203.0.114.0"],
  ["224.0.0.1", "223.255.255.255"],
  ["240.0.0.1", "223.255.255.255"],
];

describe("isBlockedAddress IPv4", () => {
  for (const [blocked, allowed] of IPV4_RANGES) {
    it(`blocks ${blocked} and allows ${allowed}`, () => {
      expect(isBlockedAddress(blocked)).toBe(true);
      expect(isBlockedAddress(allowed)).toBe(false);
    });
  }

  it("blocks the top of each block and allows the address just below it", () => {
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("172.15.255.255")).toBe(false);
    expect(isBlockedAddress("100.127.255.255")).toBe(true);
    expect(isBlockedAddress("100.63.255.255")).toBe(false);
    expect(isBlockedAddress("198.19.255.255")).toBe(true);
    expect(isBlockedAddress("239.255.255.255")).toBe(true);
  });

  it("allows a public address", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
  });
});

describe("isBlockedAddress IPv6", () => {
  it("blocks the unspecified and loopback addresses", () => {
    expect(isBlockedAddress("::")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("blocks unique local and link local addresses", () => {
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd00::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
  });

  it("blocks multicast and the documentation range", () => {
    expect(isBlockedAddress("ff02::1")).toBe(true);
    expect(isBlockedAddress("2001:db8::1")).toBe(true);
  });

  it("judges IPv4-mapped addresses by the embedded IPv4 address", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("judges NAT64 addresses by the embedded IPv4 address", () => {
    expect(isBlockedAddress("64:ff9b::a00:1")).toBe(true);
    expect(isBlockedAddress("64:ff9b::808:808")).toBe(false);
  });

  it("allows a public IPv6 address", () => {
    expect(isBlockedAddress("2606:4700::1111")).toBe(false);
  });
});

describe("isBlockedAddress junk", () => {
  it("blocks anything that does not parse", () => {
    expect(isBlockedAddress("")).toBe(true);
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("999.1.1.1")).toBe(true);
    expect(isBlockedAddress("1.2.3")).toBe(true);
    expect(isBlockedAddress("::gggg")).toBe(true);
    expect(isBlockedAddress("localhost")).toBe(true);
  });
});

describe("checkWebhookUrl", () => {
  it("refuses plain http unless private targets are allowed", () => {
    const refused = checkWebhookUrl("http://example.com/hook", false);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.id).toBe(ERROR_IDS.WEBHOOK_URL_REFUSED);
    expect(checkWebhookUrl("http://example.com/hook", true).ok).toBe(true);
  });

  it("accepts a public https URL", () => {
    const result = checkWebhookUrl("https://example.com/hooks/dealflow", false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hostname).toBe("example.com");
  });

  it("refuses credentials in the URL", () => {
    const result = checkWebhookUrl("https://user:pass@example.com/hook", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.WEBHOOK_URL_REFUSED);
  });

  it("refuses a literal private IP unless private targets are allowed", () => {
    const refused = checkWebhookUrl("https://127.0.0.1/hook", false);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.id).toBe(ERROR_IDS.WEBHOOK_URL_REFUSED);
    expect(checkWebhookUrl("https://127.0.0.1/hook", true).ok).toBe(true);
    expect(checkWebhookUrl("https://[::1]/hook", false).ok).toBe(false);
  });

  it("refuses a documentation-range literal", () => {
    expect(checkWebhookUrl("https://203.0.113.9/hook", false).ok).toBe(false);
  });

  it("refuses unparseable input and unsupported schemes", () => {
    expect(checkWebhookUrl("not a url", false).ok).toBe(false);
    expect(checkWebhookUrl("ftp://example.com/hook", false).ok).toBe(false);
  });
});
