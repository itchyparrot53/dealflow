import { describe, expect, it } from "vitest";
import type { EmailDesign } from "./tokens";
import { resolveCustomerLayout, wrapCustomerEmail } from "./wrapCustomerEmail";

const DESIGN: EmailDesign = {
  displayName: "Northwind Studio",
  accentColor: "#1F5FBF",
  logo: null,
  showAddress: false,
  addressLines: [],
  footerText: null,
  showPoweredBy: false,
  newEmailLayout: "branded",
  replyLayout: "minimal",
  footerOnReplies: false,
};

describe("resolveCustomerLayout", () => {
  it("uses the design defaults per mode", () => {
    expect(resolveCustomerLayout("new", DESIGN)).toBe("branded");
    expect(resolveCustomerLayout("automation", DESIGN)).toBe("branded");
    expect(resolveCustomerLayout("reply", DESIGN)).toBe("minimal");
    expect(resolveCustomerLayout("document", DESIGN)).toBe("branded");
  });

  it("lets an explicit choice win over the default", () => {
    expect(resolveCustomerLayout("new", DESIGN, "plain")).toBe("plain");
    expect(resolveCustomerLayout("reply", DESIGN, "branded")).toBe("branded");
  });

  it("follows the design's reply and new-email settings", () => {
    const design = { ...DESIGN, newEmailLayout: "plain" as const, replyLayout: "branded" as const };
    expect(resolveCustomerLayout("new", design)).toBe("plain");
    expect(resolveCustomerLayout("reply", design)).toBe("branded");
  });
});

describe("wrapCustomerEmail", () => {
  it("wraps a new email in the branded layout with one marker", () => {
    const result = wrapCustomerEmail({ bodyHtml: "<p>Hello.</p>", mode: "new", design: DESIGN });
    expect(result.wrapped).toBe(true);
    expect(result.layout).toBe("branded");
    expect(result.html.match(/data-df-layout=/g)).toHaveLength(1);
    expect(result.html).toContain('data-df-layout="customer-branded"');
    expect(result.text).toContain("Hello.");
  });

  it("wraps a reply in the minimal layout, with no page background", () => {
    const result = wrapCustomerEmail({ bodyHtml: "<p>Thanks.</p>", mode: "reply", design: DESIGN });
    expect(result.layout).toBe("minimal");
    expect(result.html).toContain('data-df-layout="customer-minimal"');
    expect(result.html).not.toContain("#F4F4F7");
  });

  it("returns the body unchanged for plain and for an already-wrapped body", () => {
    const plain = wrapCustomerEmail({
      bodyHtml: "<p>Hello.</p>",
      mode: "new",
      layoutOverride: "plain",
      design: DESIGN,
    });
    expect(plain).toMatchObject({ html: "<p>Hello.</p>", wrapped: false, layout: "plain" });

    const already = '<table data-df-layout="customer-branded"><tr><td>x</td></tr></table>';
    const again = wrapCustomerEmail({ bodyHtml: already, mode: "new", design: DESIGN });
    expect(again).toMatchObject({ html: already, wrapped: false, layout: null });
  });

  it("renders the document summary and button inside the layout", () => {
    const result = wrapCustomerEmail({
      bodyHtml: "<p>Your quote is ready.</p>",
      mode: "document",
      design: DESIGN,
      summary: { rows: [{ label: "Total", value: "£1,200.00" }] },
      cta: { label: "View quote", url: "https://app.example.com/d/q1" },
    });
    expect(result.html).toContain("£1,200.00");
    expect(result.html).toContain('href="https://app.example.com/d/q1"');
    expect(result.html).toContain(">View quote</a>");
  });
});
