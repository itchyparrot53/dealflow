// Removes the Bcc header and its folded continuation lines from the header block only. The body
// is untouched, including a body line that happens to start with "Bcc:".
export function stripBccHeader(raw: string): string {
  const separator = raw.search(/\r?\n\r?\n/);
  if (separator === -1) return raw;
  const headers = raw.slice(0, separator);
  const body = raw.slice(separator);
  const cleaned = headers.replace(/^Bcc:[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*\r?\n?/gim, "");
  return cleaned + body;
}
