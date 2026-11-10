import { renderMerge } from "../blocks/personalize";

// 6.7 and 6.8: the pure half of campaign tracking. The send rewrites only http(s) body links to
// the recipient's click URL and appends the pixel; the footer's unsubscribe and web-version links
// are per-recipient credentials, never tracked. The click route later renders the stored URL
// template with the recipient's merge values, so the redirect target never comes from a request.

export interface CampaignLinkTemplate {
  linkIndex: number;
  urlTemplate: string;
}

export function trackingOrigin(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function clickTrackingUrl(baseUrl: string, token: string, linkIndex: number): string {
  return `${trackingOrigin(baseUrl)}/t/c/l/${encodeURIComponent(token)}/${linkIndex}`;
}

export function openPixelUrl(baseUrl: string, token: string): string {
  return `${trackingOrigin(baseUrl)}/t/c/o/${encodeURIComponent(token)}.gif`;
}

// href -> click URL. The renderer always emits double-quoted attributes, and `links` holds the
// ordered unique hrefs from the same rendered HTML, so the index is the campaign_links index.
export function rewriteTrackedHtml(
  html: string,
  trackedByHref: ReadonlyMap<string, string>,
): string {
  return html.replace(/href="([^"]*)"/g, (match, href: string) => {
    const tracked = trackedByHref.get(href);
    return tracked === undefined ? match : `href="${tracked}"`;
  });
}

// The text part has no href attributes, so each stored template is rendered in text mode and its
// plain URL replaced. Longest first keeps a URL that is a prefix of another from half-replacing.
export function rewriteTrackedText(
  text: string,
  links: readonly CampaignLinkTemplate[],
  values: Readonly<Record<string, string>>,
  trackedUrl: (linkIndex: number) => string,
): string {
  const rendered = links
    .map((link) => ({
      linkIndex: link.linkIndex,
      url: renderMerge(link.urlTemplate, values, "text"),
    }))
    .filter((link) => link.url.length > 0)
    .sort((a, b) => b.url.length - a.url.length);
  let output = text;
  for (const link of rendered) {
    output = output.split(link.url).join(trackedUrl(link.linkIndex));
  }
  return output;
}

export function appendOpenPixel(html: string, baseUrl: string, token: string): string {
  const pixel = `<img src="${openPixelUrl(baseUrl, token)}" width="1" height="1" alt="" style="display:block;border:0;" />`;
  const closing = html.lastIndexOf("</body>");
  return closing === -1
    ? `${html}${pixel}`
    : `${html.slice(0, closing)}${pixel}${html.slice(closing)}`;
}

// A compact, non-identifying user-agent family for opens and clicks. Raw IP addresses and the
// full user agent are deliberately not stored (6.8's privacy rule).
const UA_FAMILIES: readonly (readonly [RegExp, string])[] = [
  [/googleimageproxy|ggpht\.com/, "proxy"],
  [/outlook|microsoft office|ms-office/, "outlook"],
  [/thunderbird/, "thunderbird"],
  [/yahoo/, "yahoo"],
  [/gmail|googlemail/, "gmail"],
  [/applewebkit|apple mail|mac os x|iphone|ipad/, "apple-mail"],
  [/firefox/, "firefox"],
  [/chrome|crios/, "chrome"],
  [/safari/, "safari"],
];

export function userAgentFamily(userAgent: string | null | undefined): string | null {
  if (userAgent === null || userAgent === undefined || userAgent.trim() === "") return null;
  const lowered = userAgent.toLowerCase();
  for (const [pattern, family] of UA_FAMILIES) {
    if (pattern.test(lowered)) return family;
  }
  return "other";
}

// Apple Mail Privacy Protection and Google's image proxy fetch the pixel from a proxy, and an
// open within a second of the send is a fetch, not a person. The plan fixes the one-second rule.
const MACHINE_OPEN_UA: readonly RegExp[] = [
  /googleimageproxy/,
  /ggpht\.com/,
  /apple\s*mail\s*privacy/,
  /mail\s*privacy\s*protection/,
  /applemail/,
];

export function isMachineOpen(
  userAgent: string | null | undefined,
  sentAt: Date | null,
  openedAt: Date,
): boolean {
  if (sentAt !== null && openedAt.getTime() - sentAt.getTime() <= 1_000) return true;
  if (userAgent === null || userAgent === undefined) return false;
  const lowered = userAgent.toLowerCase();
  return MACHINE_OPEN_UA.some((pattern) => pattern.test(lowered));
}

// Click redirects are resolved from a stored template, but a stored value could still be hostile
// if the database were edited directly. Only http(s) may ever leave this function.
export function safeRedirectTarget(raw: string): string | null {
  try {
    const url = new URL(raw.replace(/&amp;/g, "&"));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function linkHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
