// The push body is what the OS notification shows, so it carries exactly what the in-app
// notification shows: title, short text and a link. The service worker receives it as text
// (web-push sends a string payload), so this module owns the JSON shape.
const BODY_MAX = 140;
const FALLBACK_URL = "/notifications";

export type PushPayloadInput = { title: string; body: string | null; href: string; id: string };

export function buildPushPayload(n: PushPayloadInput): string {
  return JSON.stringify({
    title: n.title,
    body: truncate(n.body ?? ""),
    url: sameOriginPath(n.href),
    tag: n.id,
  });
}

function truncate(text: string): string {
  if (text.length <= BODY_MAX) return text;
  return `${text.slice(0, BODY_MAX - 1)}…`;
}

// Only a same-origin path is allowed: an absolute URL could point at another site, and a
// protocol-relative one is absolute in disguise. Anything else opens the notifications list.
function sameOriginPath(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return FALLBACK_URL;
  return href;
}
