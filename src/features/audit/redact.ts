// Shared redaction for audit before/after JSON. The writer runs it before storing and the reader
// runs it again over whatever is in the table, so a caller that forgets (or a row written before
// this existed) still never shows a credential. The key match is intentionally broad: a false
// positive hides one value, while a miss stores a real secret.
const SECRET_KEY = /pass(word)?|secret|token|hash|credential|api.?key/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(entry);
  }
  return out;
}

// The writer's inputs are always objects (the audit_events columns are JSON objects), so this
// keeps the column type without a cast at every call site.
export function redactRecord(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return redact(value) as Record<string, unknown>;
}
