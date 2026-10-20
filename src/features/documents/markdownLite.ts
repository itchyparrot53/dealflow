// A deliberately tiny markdown subset for document bodies. It is parsed into
// blocks and rendered as React elements only, so a template can never inject
// HTML into a public page.

export type MdBlock =
  | { type: "h1" | "h2" | "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "products" }
  | { type: "hr" };

const H1_PREFIX = "# ";
const H2_PREFIX = "## ";
const LIST_PREFIX = "- ";
const RULE = "---";
const PRODUCTS_MARKER = "{{products}}";

export function parseMarkdownLite(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = (): void => {
    if (items.length === 0) return;
    blocks.push({ type: "ul", items });
    items = [];
  };
  const flush = (): void => {
    flushParagraph();
    flushList();
  };

  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith(H2_PREFIX)) {
      flush();
      blocks.push({ type: "h2", text: line.slice(H2_PREFIX.length).trim() });
      continue;
    }
    if (line.startsWith(H1_PREFIX)) {
      flush();
      blocks.push({ type: "h1", text: line.slice(H1_PREFIX.length).trim() });
      continue;
    }
    if (line === RULE) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }
    if (line === PRODUCTS_MARKER) {
      flush();
      blocks.push({ type: "products" });
      continue;
    }
    if (line.startsWith(LIST_PREFIX)) {
      flushParagraph();
      items.push(line.slice(LIST_PREFIX.length).trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

export interface InlineSegment {
  text: string;
  bold: boolean;
}

// Only **bold** is supported. A lone ** is text, not a formatting error, because
// a customer-facing page must show exactly what the template author typed.
const BOLD = /\*\*(.+?)\*\*/g;

export function inlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(BOLD)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), bold: false });
    // Slice the inner text from the source rather than reading a capture group,
    // so the code is independent of the regex index type.
    segments.push({ text: text.slice(start + 2, end - 2), bold: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), bold: false });
  return segments;
}
