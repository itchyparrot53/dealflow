import { describe, expect, it } from "vitest";
import {
  appendOpenPixel,
  clickTrackingUrl,
  isMachineOpen,
  linkHost,
  openPixelUrl,
  rewriteTrackedHtml,
  rewriteTrackedText,
  safeRedirectTarget,
  userAgentFamily,
} from "./links";

const NOW = new Date("2026-11-10T12:00:00.000Z");

describe("campaign tracking URLs", () => {
  it("builds the pixel and click paths from the base origin", () => {
    expect(openPixelUrl("https://app.example.com/", "token")).toBe(
      "https://app.example.com/t/c/o/token.gif",
    );
    expect(clickTrackingUrl("https://app.example.com", "token", 2)).toBe(
      "https://app.example.com/t/c/l/token/2",
    );
  });

  it("rewrites body hrefs and leaves footer links alone", () => {
    const html =
      '<a href="https://example.com/a">A</a><a href="https://app.example.com/u/token">Unsubscribe</a>';
    const tracked = new Map([
      ["https://example.com/a", clickTrackingUrl("https://app.example.com", "token", 0)],
    ]);
    const out = rewriteTrackedHtml(html, tracked);
    expect(out).toContain('href="https://app.example.com/t/c/l/token/0"');
    expect(out).toContain('href="https://app.example.com/u/token"');
  });

  it("appends the pixel before the closing body", () => {
    const html = "<html><body><p>Hi</p></body></html>";
    const out = appendOpenPixel(html, "https://app.example.com", "token");
    expect(out).toContain('<img src="https://app.example.com/t/c/o/token.gif"');
    expect(out.indexOf("/t/c/o/")).toBeLessThan(out.indexOf("</body>"));
  });

  it("rewrites text URLs rendered from the stored template", () => {
    const values = { "person.email": "ada@example.com" };
    const text = "Read more: https://example.com/?ref=ada@example.com";
    const out = rewriteTrackedText(
      text,
      [{ linkIndex: 0, urlTemplate: "https://example.com/?ref={{person.email}}" }],
      values,
      (index) => `https://app.example.com/t/c/l/token/${index}`,
    );
    expect(out).toBe("Read more: https://app.example.com/t/c/l/token/0");
  });
});

describe("user agent classification", () => {
  it("maps a small set of families and never stores the raw agent", () => {
    expect(userAgentFamily(null)).toBeNull();
    expect(userAgentFamily("")).toBeNull();
    expect(userAgentFamily("Mozilla/5.0 (via ggpht.com GoogleImageProxy)")).toBe("proxy");
    expect(userAgentFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15")).toBe(
      "apple-mail",
    );
    expect(userAgentFamily("Microsoft Outlook 16.0")).toBe("outlook");
    expect(userAgentFamily("curl/8.0")).toBe("other");
  });

  it("flags proxy fetches and opens within one second of the send", () => {
    expect(isMachineOpen("Mozilla/5.0 (via ggpht.com GoogleImageProxy)", null, NOW)).toBe(true);
    expect(isMachineOpen("Apple Mail Privacy Protection", null, NOW)).toBe(true);
    expect(
      isMachineOpen("Mozilla/5.0 AppleWebKit/605.1.15", new Date(NOW.getTime() - 999), NOW),
    ).toBe(true);
    expect(
      isMachineOpen("Mozilla/5.0 AppleWebKit/605.1.15", new Date(NOW.getTime() - 5_000), NOW),
    ).toBe(false);
    expect(isMachineOpen(null, null, NOW)).toBe(false);
  });
});

describe("click redirect safety", () => {
  it("accepts only http and https targets", () => {
    expect(safeRedirectTarget("https://example.com/path")).toBe("https://example.com/path");
    expect(safeRedirectTarget("http://example.com")).toBe("http://example.com/");
    expect(safeRedirectTarget("javascript:alert(1)")).toBeNull();
    expect(safeRedirectTarget("data:text/html,hello")).toBeNull();
    expect(safeRedirectTarget("not a url")).toBeNull();
  });

  it("decodes an HTML-escaped ampersand before validating", () => {
    expect(safeRedirectTarget("https://example.com/?a=1&amp;b=2")).toBe(
      "https://example.com/?a=1&b=2",
    );
  });

  it("extracts the host for the timeline wording", () => {
    expect(linkHost("https://www.example.com/a")).toBe("www.example.com");
    expect(linkHost("not a url")).toBe("");
  });
});
