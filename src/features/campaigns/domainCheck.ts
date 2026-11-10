import { promises as dns } from "node:dns";

// 6.9's domain check: SPF, DKIM and DMARC via TXT lookups. The resolver is injected so tests never
// touch real DNS, every lookup has a 5 second ceiling, and results cache for an hour.

export type RecordStatus = "pass" | "missing" | "error";

export interface DomainRecordCheck {
  status: RecordStatus;
  detail: string;
  fix: string;
}

export interface DomainCheckResult {
  spf: DomainRecordCheck;
  dkim: DomainRecordCheck;
  dmarc: DomainRecordCheck;
}

export interface DnsResolver {
  resolveTxt(name: string): Promise<string[][]>;
}

export const defaultResolver: DnsResolver = {
  resolveTxt: (name) => dns.resolveTxt(name),
};

const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { at: number; result: DomainCheckResult }>();

type TxtLookup =
  | { kind: "txt"; records: string[] }
  | { kind: "missing" }
  | { kind: "error"; message: string };

function missingCode(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ENOTFOUND" || code === "ENODATA" || code === "ENODOMAIN";
}

function withTimeout<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("DNS lookup timed out"));
    }, TIMEOUT_MS);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function lookupTxt(
  name: string,
  resolver: DnsResolver,
  signal: AbortSignal,
): Promise<TxtLookup> {
  try {
    const chunks = await withTimeout(resolver.resolveTxt(name), signal);
    return { kind: "txt", records: chunks.map((parts) => parts.join("")) };
  } catch (error) {
    if (missingCode(error)) return { kind: "missing" };
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "lookup failed",
    };
  }
}

function spfCheck(lookup: TxtLookup, domain: string): DomainRecordCheck {
  if (lookup.kind === "txt") {
    const record = lookup.records.find((value) => value.startsWith("v=spf1"));
    if (record !== undefined) return { status: "pass", detail: record, fix: "" };
    return {
      status: "missing",
      detail: "no TXT record starts with v=spf1",
      fix: `Add a TXT record on ${domain}: v=spf1 include:your-provider.example -all`,
    };
  }
  return lookup.kind === "missing"
    ? {
        status: "missing",
        detail: "no TXT records on the domain",
        fix: `Add a TXT record on ${domain}: v=spf1 include:your-provider.example -all`,
      }
    : {
        status: "error",
        detail: lookup.message,
        fix: "Retry the check; the DNS resolver returned an error.",
      };
}

function dkimCheck(lookup: TxtLookup, domain: string, selector: string | null): DomainRecordCheck {
  if (selector === null || selector === "") {
    return {
      status: "missing",
      detail: "no DKIM selector given",
      fix: "Copy the selector from your provider (for example: mail, s1, google) and check again.",
    };
  }
  if (lookup.kind === "txt") {
    const record = lookup.records.find((value) => /(^|;)\s*p=/.test(value) || value.includes("p="));
    if (record !== undefined) return { status: "pass", detail: record, fix: "" };
    return {
      status: "missing",
      detail: "the selector record has no public key",
      fix: `Publish the DKIM public key at ${selector}._domainkey.${domain}.`,
    };
  }
  return lookup.kind === "missing"
    ? {
        status: "missing",
        detail: `no TXT record at ${selector}._domainkey.${domain}`,
        fix: "Publish the DKIM record your provider generated.",
      }
    : {
        status: "error",
        detail: lookup.message,
        fix: "Retry the check; the DNS resolver returned an error.",
      };
}

function dmarcCheck(lookup: TxtLookup, domain: string): DomainRecordCheck {
  if (lookup.kind === "txt") {
    const record = lookup.records.find((value) => value.startsWith("v=DMARC1"));
    if (record !== undefined) {
      const policy = /p=([a-z]+)/.exec(record)?.[1] ?? "none";
      return { status: "pass", detail: `policy ${policy}: ${record}`, fix: "" };
    }
    return {
      status: "missing",
      detail: "no TXT record starts with v=DMARC1",
      fix: `Add _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    };
  }
  return lookup.kind === "missing"
    ? {
        status: "missing",
        detail: `no TXT record at _dmarc.${domain}`,
        fix: `Add _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      }
    : {
        status: "error",
        detail: lookup.message,
        fix: "Retry the check; the DNS resolver returned an error.",
      };
}

export async function checkDomain(
  domain: string,
  selector: string | null,
  resolver: DnsResolver,
  signal: AbortSignal,
): Promise<DomainCheckResult> {
  const key = `${domain}|${selector ?? ""}`;
  const cached = cache.get(key);
  if (cached !== undefined && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const [spf, dkim, dmarc] = await Promise.all([
    lookupTxt(domain, resolver, signal),
    selector === null || selector === ""
      ? Promise.resolve<TxtLookup>({ kind: "missing" })
      : lookupTxt(`${selector}._domainkey.${domain}`, resolver, signal),
    lookupTxt(`_dmarc.${domain}`, resolver, signal),
  ]);
  const result: DomainCheckResult = {
    spf: spfCheck(spf, domain),
    dkim: dkimCheck(dkim, domain, selector),
    dmarc: dmarcCheck(dmarc, domain),
  };
  cache.set(key, { at: Date.now(), result });
  return result;
}

// Tests clear the hour-long cache between cases.
export function clearDomainCheckCacheForTest(): void {
  cache.clear();
}
