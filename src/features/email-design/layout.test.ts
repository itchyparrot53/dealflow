import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/constants/errorIds";
import { contrastRatio, htmlToText, renderEmail } from "./layout";
import { DEALFLOW_DESIGN, EMAIL_COLORS, type EmailDesign } from "./tokens";

const CUSTOMER: EmailDesign = {
  displayName: "Northwind Studio",
  accentColor: "#1F5FBF",
  logo: null,
  showAddress: true,
  addressLines: ["12 Harbour Road", "Bristol BS1 4RN"],
  footerText: "You receive this because you asked us for a quote.",
  showPoweredBy: false,
  newEmailLayout: "branded",
  replyLayout: "minimal",
  footerOnReplies: false,
};

function product(overrides: Partial<Parameters<typeof renderEmail>[0]> = {}) {
  return renderEmail({
    family: "product",
    layout: "branded",
    design: DEALFLOW_DESIGN,
    subject: "Your Dealflow sign-in link",
    bodyHtml: "<p>Use the button to sign in.</p>",
    ...overrides,
  });
}

describe("renderEmail: branded layout", () => {
  it("marks the product layout and keeps the 600 px container and MSO wrapper", () => {
    const { html } = product();
    expect(html).toContain('data-df-layout="product-branded"');
    expect(html).toContain('width="600"');
    expect(html).toContain("<!--[if mso]>");
    expect(html).toContain("<![endif]-->");
  });

  it("contains no script, external stylesheet, import or web font", () => {
    const { html } = product();
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("font-face");
  });

  it("puts the product logo in the header with alt text", () => {
    const { html } = product();
    expect(html).toContain('alt="Dealflow"');
    expect(html).toContain("/brand/email-logo@2x.png");
  });

  it("shows the company name instead of a logo when there is none", () => {
    const { html } = renderEmail({
      family: "customer",
      layout: "branded",
      design: CUSTOMER,
      subject: "Quote Q-1",
      bodyHtml: "<p>Hello.</p>",
    });
    expect(html).toContain("Northwind Studio");
    expect(html).not.toContain('alt="Northwind Studio"');
  });

  it("hides and escapes the preheader", () => {
    const { html } = product({ preheader: "<b>Preview</b> text" });
    expect(html).toContain("display:none;max-height:0;overflow:hidden");
    expect(html).toContain("&lt;b&gt;Preview&lt;/b&gt; text");
    expect(html).not.toContain("<b>Preview</b>");
  });

  it("keeps the button href exactly as given, escaped for the attribute", () => {
    const url = "https://app.test/sign-in?a=1&b=2";
    const { html } = product({ cta: { label: "Sign in", url } });
    expect(html).toContain(`href="${url.replace("&", "&amp;")}"`);
    expect(html).toContain(">Sign in</a>");
  });

  it("renders summary rows with escaped labels and values", () => {
    const { html } = renderEmail({
      family: "customer",
      layout: "branded",
      design: CUSTOMER,
      bodyHtml: "<p>Quote below.</p>",
      summary: {
        rows: [
          { label: "Quote", value: "Q-2026-0003" },
          { label: "Total", value: "<b>£1,200</b>" },
        ],
      },
    });
    expect(html).toContain("Q-2026-0003");
    expect(html).toContain("&lt;b&gt;£1,200&lt;/b&gt;");
  });

  it("includes the customer footer address and text", () => {
    const { html } = renderEmail({
      family: "customer",
      layout: "branded",
      design: CUSTOMER,
      bodyHtml: "<p>Hello.</p>",
    });
    expect(html).toContain("12 Harbour Road");
    expect(html).toContain("You receive this because you asked us for a quote.");
  });
});

describe("renderEmail: minimal layout", () => {
  it("marks the reply layout and has no page background or logo", () => {
    const { html } = renderEmail({
      family: "customer",
      layout: "minimal",
      design: CUSTOMER,
      bodyHtml: "<p>Thanks for your reply.</p>",
    });
    expect(html).toContain('data-df-layout="customer-minimal"');
    expect(html).not.toContain(EMAIL_COLORS.page);
    expect(html).not.toContain("<img");
    expect(html).not.toContain('alt="Northwind Studio"');
  });

  it("adds the footer only when the design enables it on replies", () => {
    const withoutFooter = renderEmail({
      family: "customer",
      layout: "minimal",
      design: CUSTOMER,
      bodyHtml: "<p>Hello.</p>",
    });
    expect(withoutFooter.html).not.toContain("12 Harbour Road");

    const withFooter = renderEmail({
      family: "customer",
      layout: "minimal",
      design: { ...CUSTOMER, footerOnReplies: true },
      bodyHtml: "<p>Hello.</p>",
    });
    expect(withFooter.html).toContain("12 Harbour Road");
  });
});

describe("renderEmail: plain text", () => {
  it("names the button URL so a text-only client can still act", () => {
    const url = "https://app.test/sign-in?a=1&b=2";
    const { text } = product({ cta: { label: "Sign in", url } });
    expect(text).toContain(`Sign in: ${url}`);
    expect(text).toContain("Use the button to sign in.");
  });

  it("converts links in the body to text followed by the URL", () => {
    expect(htmlToText('<p>See <a href="https://x.test/a">the page</a>.</p>')).toContain(
      "the page (https://x.test/a)",
    );
  });
});

describe("renderEmail: size guard", () => {
  it("throws for a product email over 90 KB", () => {
    expect(() => product({ bodyHtml: `<p>${"x".repeat(100_000)}</p>` })).toThrow(AppError);
    try {
      product({ bodyHtml: `<p>${"x".repeat(100_000)}</p>` });
    } catch (error) {
      expect((error as AppError).id).toBe("E_EMAIL_DESIGN_001");
    }
  });

  it("warns and still renders a customer email over 90 KB", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = renderEmail({
      family: "customer",
      layout: "branded",
      design: CUSTOMER,
      bodyHtml: `<p>${"x".repeat(100_000)}</p>`,
    });
    expect(result.html.length).toBeGreaterThan(90_000);
    expect(warn).toHaveBeenCalledWith("email.layout_too_large", expect.any(Object));
    warn.mockRestore();
  });
});

describe("contrastRatio", () => {
  it("accepts the default accent with white button text", () => {
    expect(contrastRatio(EMAIL_COLORS.dealflowAccent, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects a pale accent", () => {
    expect(contrastRatio("#9BE7B3", "#FFFFFF")).toBeLessThan(4.5);
  });
});
