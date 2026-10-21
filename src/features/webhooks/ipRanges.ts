import { isIP } from "node:net";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok, type Result } from "@/types/result";

// SSRF protection for outgoing webhooks. This module is pure: the delivery job resolves the
// hostname with these checks inside the DNS lookup, so a check cannot be separated from the
// connection it protects. Anything that does not parse is blocked, because a target we cannot
// classify is one we cannot vouch for.

interface V4Range {
  base: number;
  bits: number;
}

function ip4(a: number, b: number, c: number, d: number): number {
  return ((a * 256 + b) * 256 + c) * 256 + d;
}

// 6.6's IPv4 block list, in the order the contract lists it.
const BLOCKED_V4: V4Range[] = [
  { base: ip4(0, 0, 0, 0), bits: 8 },
  { base: ip4(10, 0, 0, 0), bits: 8 },
  { base: ip4(100, 64, 0, 0), bits: 10 },
  { base: ip4(127, 0, 0, 0), bits: 8 },
  { base: ip4(169, 254, 0, 0), bits: 16 },
  { base: ip4(172, 16, 0, 0), bits: 12 },
  { base: ip4(192, 0, 0, 0), bits: 24 },
  { base: ip4(192, 0, 2, 0), bits: 24 },
  { base: ip4(192, 168, 0, 0), bits: 16 },
  { base: ip4(198, 18, 0, 0), bits: 15 },
  { base: ip4(198, 51, 100, 0), bits: 24 },
  { base: ip4(203, 0, 113, 0), bits: 24 },
  { base: ip4(224, 0, 0, 0), bits: 4 },
  { base: ip4(240, 0, 0, 0), bits: 4 },
];

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function isBlockedV4(value: number): boolean {
  return BLOCKED_V4.some((range) => {
    const mask = range.bits === 0 ? 0 : (0xffffffff << (32 - range.bits)) >>> 0;
    return (value & mask) >>> 0 === (range.base & mask) >>> 0;
  });
}

// Expand to eight 16-bit groups. Handles `::` compression and a dotted-quad tail
// (`::ffff:127.0.0.1`), which is how the IPv4-mapped form is usually written.
function expandIpv6(ip: string): number[] | null {
  let text = ip;
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":");
    if (lastColon < 0) return null;
    const embedded = parseIpv4(text.slice(lastColon + 1));
    if (embedded === null) return null;
    const high = Math.floor(embedded / 65_536).toString(16);
    const low = (embedded % 65_536).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups = part.split(":");
    const out: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      out.push(Number.parseInt(group, 16));
    }
    return out;
  };

  const left = parseGroups(halves[0] ?? "");
  if (left === null) return null;
  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }
  const right = parseGroups(halves[1] ?? "");
  if (right === null) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  // Array.from keeps the padding explicit without a sparse array; groups are all zero here.
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function embeddedV4(high: number, low: number): number {
  return high * 65_536 + low;
}

function isBlockedV6(groups: number[]): boolean {
  const g0 = groups[0] ?? 0;
  const g1 = groups[1] ?? 0;
  const g5 = groups[5] ?? 0;
  const g6 = groups[6] ?? 0;
  const g7 = groups[7] ?? 0;

  // ::/128
  if (groups.every((group) => group === 0)) return true;
  // ::1/128
  if (groups.slice(0, 7).every((group) => group === 0) && g7 === 1) return true;
  // ::ffff:0:0/96 is judged by the IPv4 address it carries.
  if (groups.slice(0, 5).every((group) => group === 0) && g5 === 0xffff) {
    return isBlockedV4(embeddedV4(g6, g7));
  }
  // 64:ff9b::/96 (NAT64) is judged the same way.
  if (g0 === 0x0064 && g1 === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) {
    return isBlockedV4(embeddedV4(g6, g7));
  }
  // fc00::/7
  if ((g0 & 0xfe00) === 0xfc00) return true;
  // fe80::/10
  if ((g0 & 0xffc0) === 0xfe80) return true;
  // ff00::/8
  if ((g0 & 0xff00) === 0xff00) return true;
  // 2001:db8::/32
  if (g0 === 0x2001 && g1 === 0x0db8) return true;
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const value = parseIpv4(ip);
    return value === null ? true : isBlockedV4(value);
  }
  if (version === 6) {
    const groups = expandIpv6(ip);
    return groups === null ? true : isBlockedV6(groups);
  }
  return true;
}

// A webhook target must parse, use https (plain http only when private targets are allowed,
// which is a test and local-receiver knob), carry no credentials, and not be a blocked literal.
// Hostnames are checked again inside the delivery lookup, where the resolved address is known.
export function checkWebhookUrl(raw: string, allowPrivate: boolean): Result<URL, AppError> {
  const refuse = (reason: string): Result<URL, AppError> =>
    err(new AppError(ERROR_IDS.WEBHOOK_URL_REFUSED, reason, {}));

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refuse("not a valid URL");
  }

  if (url.username !== "" || url.password !== "") {
    return refuse("credential in URL");
  }
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) {
    return refuse("unsupported scheme");
  }
  if (!allowPrivate) {
    const host = url.hostname;
    const literal = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    if (isIP(literal) !== 0 && isBlockedAddress(literal)) {
      return refuse("private or reserved address");
    }
  }
  return ok(url);
}
