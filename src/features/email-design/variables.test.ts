import { describe, expect, it } from "vitest";
import { escapeHtml, renderVariables, stripHeaderBreaks } from "./variables";

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'> & more`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; more",
    );
  });
});

describe("renderVariables", () => {
  const values = {
    "recipient.name": "Mia <b>Novak</b>",
    "link.url": "https://app.example.com/sign-in?t=1&next=2",
  };

  it("escapes values in html mode so a name cannot inject markup", () => {
    const rendered = renderVariables("<p>Hi {{recipient.name}}</p>", values, { mode: "html" });
    expect(rendered).toBe("<p>Hi Mia &lt;b&gt;Novak&lt;/b&gt;</p>");
    expect(rendered).not.toContain("<b>");
  });

  it("escapes the ampersand in a URL used as an href attribute", () => {
    expect(renderVariables('<a href="{{link.url}}">x</a>', values, { mode: "html" })).toContain(
      "t=1&amp;next=2",
    );
  });

  it("inserts values raw in text mode", () => {
    expect(renderVariables("Hi {{recipient.name}}", values, { mode: "text" })).toBe(
      "Hi Mia <b>Novak</b>",
    );
  });

  it("accepts spaces inside the braces", () => {
    expect(renderVariables("Hi {{ recipient.name }}", values, { mode: "text" })).toBe(
      "Hi Mia <b>Novak</b>",
    );
  });

  it("renders an unknown token as an empty string", () => {
    expect(renderVariables("Hi {{recipient.nickname}}!", values, { mode: "html" })).toBe("Hi !");
  });

  it("leaves text that is not a token alone", () => {
    expect(renderVariables("<p>{{ not a token }}</p>", values, { mode: "html" })).toBe(
      "<p>{{ not a token }}</p>",
    );
  });
});

describe("stripHeaderBreaks", () => {
  it("removes CR, LF and other control characters and collapses the gap", () => {
    expect(stripHeaderBreaks("Hello\r\nBcc: evil@example.com", 200)).toBe(
      "Hello Bcc: evil@example.com",
    );
    expect(stripHeaderBreaks("a\u0000b\tc", 200)).toBe("a b c");
  });

  it("trims and cuts to the limit", () => {
    expect(stripHeaderBreaks("  spaced  ", 200)).toBe("spaced");
    expect(stripHeaderBreaks("x".repeat(300), 140)).toHaveLength(140);
  });
});
