import { createHash } from "node:crypto";

// Canonical form of an RFC 822 Message-ID: lowercased, wrapped in angle brackets, and reduced to
// the first <...> token when surrounding text or whitespace sneaks in.
export function normalizeMessageId(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const token = /<[^<>]+>/.exec(trimmed);
  return (token !== null ? token[0] : `<${trimmed}>`).toLowerCase();
}

// Stable id for a message whose provider and headers carry no Message-ID. The fields make the
// same physical message hash to the same id across re-syncs and folders.
export function syntheticMessageId(fields: {
  from: string;
  date: string;
  subject: string;
  size: number;
}): string {
  const digest = createHash("sha256")
    .update([fields.from, fields.date, fields.subject, String(fields.size)].join("|"))
    .digest("hex")
    .slice(0, 32);
  return `<synthetic-${digest}@dealflow.invalid>`;
}
