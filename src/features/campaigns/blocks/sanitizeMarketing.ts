import sanitizeHtml from "sanitize-html";

// The marketing HTML profile (6.4): table layout and inline styles are allowed because that is how
// email is built; scripts, forms, frames, objects and event handlers are not. `<style>` is stripped
// (the UI warns that styles must be inline) and data: images are only allowed under 32 KB.

const ALLOWED_TAGS = [
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "div",
  "p",
  "span",
  "a",
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "blockquote",
  "center",
  "font",
];

const GLOBAL_ATTRS = [
  "class",
  "id",
  "style",
  "align",
  "valign",
  "width",
  "height",
  "role",
  "bgcolor",
  "cellpadding",
  "cellspacing",
  "border",
  "colspan",
  "rowspan",
];

const STYLE_PROPS = [
  "color",
  "background",
  "background-color",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "vertical-align",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "border-collapse",
  "width",
  "max-width",
  "height",
  "display",
];

// A style value may not smuggle a script: no url(), expression(), javascript: or angle brackets.
const SAFE_STYLE_VALUE = /^(?!.*(?:url\s*\(|expression\s*\(|javascript:))[^<>]*$/i;

const DATA_IMAGE = /^data:image\/(png|jpeg);base64,/i;
const MAX_DATA_IMAGE_BYTES = 32 * 1024;

const allowedStyles = Object.fromEntries(
  STYLE_PROPS.map((property) => [property, [SAFE_STYLE_VALUE]]),
) as Record<string, RegExp[]>;

function dataImageAllowed(src: string): boolean {
  if (!DATA_IMAGE.test(src)) return false;
  const base64 = src.slice(src.indexOf(",") + 1);
  // 4 base64 characters carry 3 bytes; no Buffer, so the module stays client-safe.
  return Math.floor((base64.length * 3) / 4) <= MAX_DATA_IMAGE_BYTES;
}

function removedTags(html: string): string[] {
  const allowed = new Set(ALLOWED_TAGS);
  const removed = new Set<string>();
  for (const match of html.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9-]*)/g)) {
    const tag = match[1]?.toLowerCase();
    if (tag !== undefined && !allowed.has(tag)) removed.add(tag);
  }
  if (/\son[a-z]+\s*=/i.test(html)) removed.add("inline event handler");
  if (/javascript:/i.test(html)) removed.add("javascript: URL");
  if (/<style[\s>]/i.test(html)) removed.add("style block");
  return [...removed];
}

export interface SanitizedMarketingHtml {
  html: string;
  removed: string[];
}

export function sanitizeMarketingHtml(input: string): SanitizedMarketingHtml {
  const removed = removedTags(input);
  const html = sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": GLOBAL_ATTRS,
      a: [...GLOBAL_ATTRS, "href", "target", "rel", "title"],
      img: [...GLOBAL_ATTRS, "src", "alt", "border"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedStyles: { "*": allowedStyles },
    disallowedTagsMode: "discard",
    transformTags: {
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        if (/^data:/i.test(src) && !dataImageAllowed(src)) {
          const { src: _dropped, ...rest } = attribs;
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
    },
  });
  return { html, removed };
}
