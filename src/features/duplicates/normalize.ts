// Normalised keys for duplicate detection (6.5/6.7). SQL cannot express diacritic folding or the
// legal-suffix list exactly, so the finder narrows candidates with a loose SQL key and applies
// these functions in TypeScript.

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Digits only, so "+1 (555) 123-4567" and "555.123.4567" share a key. Fewer than 7 digits is not
// a believable phone number and returns null instead of a collision-prone short key.
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length < 7 ? null : digits;
}

export function phoneKey(value: string): string | null {
  const digits = normalizePhone(value);
  return digits === null ? null : digits.slice(-9);
}

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePersonName(value: string): string {
  return fold(value);
}

// Trailing legal forms only: "Acme Ltd." and "ACME Limited" both normalise to "acme", while
// "Limited Edition" keeps its first word.
const LEGAL_SUFFIXES = new Set([
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "llc",
  "gmbh",
  "plc",
  "co",
  "corp",
  "corporation",
  "company",
]);

export function normalizeOrgName(value: string): string {
  const words = fold(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  while (words.length > 1) {
    const last = words[words.length - 1];
    if (last === undefined || !LEGAL_SUFFIXES.has(last)) break;
    words.pop();
  }
  return words.join(" ");
}

// The host of a URL or bare domain, without the "www." prefix. Null when the value is not a URL.
export function domainOf(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "" ? null : host;
  } catch {
    return null;
  }
}
