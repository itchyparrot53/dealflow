// Reply and forward prefixes in the languages our users actually receive. The optional [n] or
// (n) suffix covers "Re[2]:" and "AW(3):".
const REPLY_PREFIX = /^(?:re|fw|fwd|aw|sv|antw|tr|wg)(?:\[\d+\]|\(\d+\))?\s*:\s*/i;

function stripPrefixes(subject: string): { value: string; stripped: boolean } {
  let value = subject.trim();
  let stripped = false;
  for (;;) {
    const next = value.replace(REPLY_PREFIX, "");
    if (next === value) break;
    value = next.trim();
    stripped = true;
  }
  return { value, stripped };
}

// Subject comparison key for threading: lowercase, reply/forward prefixes stripped repeatedly,
// whitespace collapsed.
export function normalizeSubject(subject: string | null): string {
  if (subject === null) return "";
  return stripPrefixes(subject).value.toLowerCase().replace(/\s+/g, " ").trim();
}

// True when the subject carried at least one reply/forward prefix. Used to decide whether a
// message may join an existing thread by subject alone.
export function hadReplyPrefix(subject: string | null): boolean {
  if (subject === null) return false;
  return stripPrefixes(subject).stripped;
}
