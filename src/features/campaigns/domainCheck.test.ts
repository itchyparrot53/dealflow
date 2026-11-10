import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkDomain, clearDomainCheckCacheForTest, type DnsResolver } from "./domainCheck";

const signal = new AbortController().signal;

function resolverOf(records: Record<string, string[][]>): DnsResolver {
  return {
    resolveTxt: (name) => {
      const value = records[name];
      if (value === undefined) {
        const error = new Error("not found") as Error & { code?: string };
        error.code = "ENOTFOUND";
        return Promise.reject(error);
      }
      return Promise.resolve(value);
    },
  };
}

beforeEach(() => clearDomainCheckCacheForTest());
afterEach(() => vi.useRealTimers());

describe("domain check", () => {
  it("passes SPF, DKIM and DMARC when all records exist", async () => {
    const resolver = resolverOf({
      "example.com": [["v=spf1 include:provider.example -all"]],
      "mail._domainkey.example.com": [["v=DKIM1; k=rsa; p=MIGf"]],
      "_dmarc.example.com": [["v=DMARC1; p=quarantine"]],
    });
    const result = await checkDomain("example.com", "mail", resolver, signal);
    expect(result.spf.status).toBe("pass");
    expect(result.dkim.status).toBe("pass");
    expect(result.dmarc.status).toBe("pass");
    expect(result.dmarc.detail).toContain("policy quarantine");
  });

  it("reports missing records with a one-line fix", async () => {
    const result = await checkDomain("example.com", null, resolverOf({}), signal);
    expect(result.spf.status).toBe("missing");
    expect(result.spf.fix).toContain("v=spf1");
    expect(result.dkim.status).toBe("missing");
    expect(result.dkim.fix).toContain("selector");
    expect(result.dmarc.status).toBe("missing");
  });

  it("reports a resolver error per record", async () => {
    const resolver: DnsResolver = {
      resolveTxt: () => Promise.reject(new Error("SERVFAIL")),
    };
    const result = await checkDomain("example.com", "mail", resolver, signal);
    expect(result.spf.status).toBe("error");
    expect(result.dkim.status).toBe("error");
    expect(result.dmarc.status).toBe("error");
  });

  it("times out a hanging lookup after five seconds", async () => {
    vi.useFakeTimers();
    const resolver: DnsResolver = { resolveTxt: () => new Promise<string[][]>(() => undefined) };
    const pending = checkDomain("example.com", "mail", resolver, signal);
    await vi.advanceTimersByTimeAsync(5_100);
    const result = await pending;
    expect(result.spf.status).toBe("error");
    expect(result.spf.detail).toContain("timed out");
  });

  it("caches a result for the hour", async () => {
    let calls = 0;
    const resolver: DnsResolver = {
      resolveTxt: () => {
        calls += 1;
        return Promise.resolve([["v=spf1 -all"]]);
      },
    };
    await checkDomain("cached.example", "mail", resolver, signal);
    await checkDomain("cached.example", "mail", resolver, signal);
    expect(calls).toBe(3);
  });
});
