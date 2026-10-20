import { describe, expect, it } from "vitest";
import { inlineSegments, parseMarkdownLite } from "./markdownLite";
import { renderVariables } from "./variables";

describe("parseMarkdownLite", () => {
  it("returns no blocks for empty and whitespace-only input", () => {
    expect(parseMarkdownLite("")).toEqual([]);
    expect(parseMarkdownLite("  \n\n\t\n")).toEqual([]);
  });

  it("parses every block type in order", () => {
    const src = [
      "# Heading one",
      "## Heading two",
      "---",
      "- first",
      "- second",
      "{{products}}",
      "a paragraph",
    ].join("\n");
    expect(parseMarkdownLite(src)).toEqual([
      { type: "h1", text: "Heading one" },
      { type: "h2", text: "Heading two" },
      { type: "hr" },
      { type: "ul", items: ["first", "second"] },
      { type: "products" },
      { type: "p", text: "a paragraph" },
    ]);
  });

  it("accepts CRLF line endings", () => {
    expect(parseMarkdownLite("# Title\r\n\r\nHello\r\nworld")).toEqual([
      { type: "h1", text: "Title" },
      { type: "p", text: "Hello world" },
    ]);
  });

  it("joins consecutive lines into one paragraph and a blank line ends it", () => {
    expect(parseMarkdownLite("one\ntwo\n\nthree")).toEqual([
      { type: "p", text: "one two" },
      { type: "p", text: "three" },
    ]);
  });

  it("starts a new paragraph when a heading interrupts", () => {
    expect(parseMarkdownLite("before\n# after")).toEqual([
      { type: "p", text: "before" },
      { type: "h1", text: "after" },
    ]);
  });

  it("only treats a line that is exactly {{products}} as the products block", () => {
    expect(parseMarkdownLite("see {{products}} here")).toEqual([
      { type: "p", text: "see {{products}} here" },
    ]);
    expect(parseMarkdownLite("  {{products}}  ")).toEqual([{ type: "products" }]);
  });

  it("splits a run of dash lines into one list and ends it at a non-item", () => {
    expect(parseMarkdownLite("- a\n- b\nplain\n- c")).toEqual([
      { type: "ul", items: ["a", "b"] },
      { type: "p", text: "plain" },
      { type: "ul", items: ["c"] },
    ]);
  });

  it("keeps a lone hash without a space literal", () => {
    expect(parseMarkdownLite("#nope")).toEqual([{ type: "p", text: "#nope" }]);
  });
});

describe("inlineSegments", () => {
  it("returns one plain segment when there is no bold", () => {
    expect(inlineSegments("plain text")).toEqual([{ text: "plain text", bold: false }]);
  });

  it("marks a bold span and keeps the surrounding text", () => {
    expect(inlineSegments("a **bold** c")).toEqual([
      { text: "a ", bold: false },
      { text: "bold", bold: true },
      { text: " c", bold: false },
    ]);
  });

  it("handles two bold spans", () => {
    expect(inlineSegments("**a** and **b**")).toEqual([
      { text: "a", bold: true },
      { text: " and ", bold: false },
      { text: "b", bold: true },
    ]);
  });

  it("leaves an unmatched ** literal", () => {
    expect(inlineSegments("a ** b")).toEqual([{ text: "a ** b", bold: false }]);
    expect(inlineSegments("**open")).toEqual([{ text: "**open", bold: false }]);
  });

  it("does not treat an empty pair as bold", () => {
    expect(inlineSegments("****")).toEqual([{ text: "****", bold: false }]);
  });
});

describe("renderVariables", () => {
  const ctx = {
    "deal.title": "Big deal",
    "person.name": "Ada",
    "document.number": "Q-2026-0001",
  };

  it("replaces a known key", () => {
    expect(renderVariables("Deal: {{deal.title}}", ctx)).toBe("Deal: Big deal");
  });

  it("allows spaces inside the braces", () => {
    expect(renderVariables("Hi {{ person.name }}", ctx)).toBe("Hi Ada");
  });

  it("renders an unknown key as empty text", () => {
    expect(renderVariables("[{{nope.nothing}}]", ctx)).toBe("[]");
  });

  it("keeps {{products}} intact because the block owns that marker", () => {
    expect(renderVariables("{{products}}", {})).toBe("{{products}}");
    expect(renderVariables("x {{ products }} y", {})).toBe("x {{ products }} y");
  });

  it("keeps document.* when keepPrefix is document.", () => {
    expect(renderVariables("No. {{document.number}}", ctx, { keepPrefix: "document." })).toBe(
      "No. {{document.number}}",
    );
  });

  it("keeps the prefix even with spaces around the key", () => {
    expect(renderVariables("No. {{ document.number }}", ctx, { keepPrefix: "document." })).toBe(
      "No. {{ document.number }}",
    );
  });

  it("still replaces other keys while keeping the prefix", () => {
    expect(
      renderVariables("{{person.name}} {{document.number}}", ctx, { keepPrefix: "document." }),
    ).toBe("Ada {{document.number}}");
  });

  it("renders a missing context value as empty rather than throwing", () => {
    expect(renderVariables("{{owner.email}}", ctx)).toBe("");
  });
});
