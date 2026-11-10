import { describe, expect, it } from "vitest";
import type { EmailDesign } from "@/features/email-design/tokens";
import { renderMerge } from "./personalize";
import { renderPlainText } from "./plainText";
import { type CampaignRenderContext, campaignSizeState, renderCampaign } from "./render";
import { sanitizeMarketingHtml } from "./sanitizeMarketing";
import { type CampaignDocument, campaignDocumentSchema } from "./schema";

const DESIGN: EmailDesign = {
  displayName: "Northwind Studio",
  accentColor: "#2D8548",
  logo: null,
  showAddress: true,
  addressLines: ["1 Market Street"],
  footerText: null,
  showPoweredBy: false,
  newEmailLayout: "branded",
  replyLayout: "minimal",
  footerOnReplies: false,
};

const VALUES: Record<string, string> = {
  "person.first_name": "Ada",
  "person.name": "Ada Lovelace",
  "company.name": "Northwind Studio",
  unsubscribe_url: "https://app.example.com/u/token",
  web_version_url: "https://app.example.com/v/token",
};

const ID = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;

const DOC: CampaignDocument = {
  version: 1,
  settings: {
    backgroundColor: "#F4F4F2",
    contentWidth: 600,
    fontFamily: "system",
    linkColor: "#2D8548",
  },
  blocks: [
    { id: "b1", type: "header", logo: "none", align: "left" },
    {
      id: "b2",
      type: "heading",
      text: "Hello {{person.first_name|there}}",
      level: 1,
      align: "left",
    },
    {
      id: "b3",
      type: "text",
      html: "<p>Read the <a href='https://example.com/one'>update</a>.</p>",
    },
    {
      id: "b4",
      type: "image",
      assetId: ID(1),
      alt: "Photo",
      width: 320,
      href: "https://example.com/image-link",
      align: "center",
    },
    {
      id: "b5",
      type: "button",
      label: "Read more",
      href: "https://example.com/one",
      align: "left",
    },
    {
      id: "b6",
      type: "columns",
      columns: [
        [{ id: "c1", type: "text", html: "<p>Left column</p>" }],
        [
          {
            id: "c2",
            type: "button",
            label: "Right",
            href: "https://example.com/right",
            align: "left",
          },
        ],
      ],
    },
    {
      id: "b7",
      type: "social",
      links: [{ network: "linkedin", url: "https://linkedin.com/company/x" }],
    },
    { id: "b8", type: "divider" },
    { id: "b9", type: "spacer", height: 24 },
    {
      id: "b10",
      type: "html",
      html: "<table><tr><td style='color:#333'>HTML block</td></tr></table>",
    },
  ],
};

const CTX: CampaignRenderContext = {
  design: DESIGN,
  values: VALUES,
  postalAddress: "1 Market Street, London",
  baseUrl: "https://app.example.com",
  assetUrl: (assetId) => `https://app.example.com/email-assets/c/${assetId}.png`,
  preheader: "{{person.first_name}}, your update",
};

describe("campaign block document", () => {
  it("accepts a valid document and rejects a nested columns block", () => {
    expect(campaignDocumentSchema.safeParse(DOC).success).toBe(true);
    const nested = {
      ...DOC,
      blocks: [
        {
          id: "cols",
          type: "columns",
          columns: [[{ id: "n1", type: "columns", columns: [[], []] }], []],
        },
      ],
    };
    expect(campaignDocumentSchema.safeParse(nested).success).toBe(false);
  });

  it("rejects an image wider than 600 and a non-http link", () => {
    const wide = {
      ...DOC,
      blocks: [{ id: "img", type: "image", assetId: ID(2), alt: "x", width: 601, align: "center" }],
    };
    expect(campaignDocumentSchema.safeParse(wide).success).toBe(false);
    const badLink = {
      ...DOC,
      blocks: [
        { id: "btn", type: "button", label: "x", href: "javascript:alert(1)", align: "left" },
      ],
    };
    expect(campaignDocumentSchema.safeParse(badLink).success).toBe(false);
  });
});

describe("renderCampaign", () => {
  const rendered = renderCampaign(DOC, CTX);

  it("always appends the footer with unsubscribe, web version and postal address", () => {
    expect(rendered.html).toContain("Unsubscribe");
    expect(rendered.html).toContain("View in browser");
    expect(rendered.html).toContain("1 Market Street, London");
    expect(rendered.html).toContain("You received this email because you subscribed");
    expect(rendered.html).toContain(VALUES.unsubscribe_url ?? "");
    expect(rendered.html).toContain(VALUES.web_version_url ?? "");
  });

  it("renders merge values escaped and falls back when a value is missing", () => {
    expect(rendered.html).toContain("Hello Ada");
    const hostile: CampaignRenderContext = {
      ...CTX,
      values: { ...VALUES, "person.first_name": "<b>Ada</b>" },
    };
    const escaped = renderCampaign(DOC, hostile);
    expect(escaped.html).toContain("Hello &lt;b&gt;Ada&lt;/b&gt;");
    expect(escaped.html).not.toContain("<b>Ada</b>");
    const missing = renderCampaign(DOC, { ...CTX, values: { ...VALUES, "person.first_name": "" } });
    expect(missing.html).toContain("Hello there");
  });

  it("keeps no script, iframe or event handler", () => {
    expect(rendered.html).not.toContain("<script");
    expect(rendered.html).not.toContain("<iframe");
    expect(rendered.html).not.toMatch(/\sonerror=/i);
  });

  it("stacks the two columns below 620px", () => {
    expect(rendered.html).toContain("df-col");
    expect(rendered.html).toContain("@media only screen and (max-width:620px)");
  });

  it("extracts the ordered unique campaign links and excludes the structural URLs", () => {
    expect(rendered.links).toEqual([
      "https://example.com/one",
      "https://example.com/image-link",
      "https://example.com/right",
      "https://linkedin.com/company/x",
    ]);
  });

  it("reports bytes and the 90/100 KB size states", () => {
    expect(rendered.bytes).toBeGreaterThan(0);
    expect(rendered.warning).toBe(false);
    expect(campaignSizeState(91 * 1024)).toEqual({ warning: true, overLimit: false });
    expect(campaignSizeState(101 * 1024)).toEqual({ warning: true, overLimit: true });
  });
});

describe("renderPlainText", () => {
  it("uppercases headings, writes buttons as Label: url and images as [alt]", () => {
    const text = renderPlainText(DOC, CTX);
    expect(text).toContain("HELLO ADA");
    expect(text).toContain("[Photo]");
    expect(text).toContain("Read more: https://example.com/one");
    expect(text).toContain("Unsubscribe: https://app.example.com/u/token");
    expect(text).toContain("1 Market Street, London");
  });
});

describe("renderMerge", () => {
  it("uses the fallback only when the value is empty", () => {
    expect(renderMerge("{{person.first_name|there}}", {}, "text")).toBe("there");
    expect(renderMerge("{{person.first_name|there}}", { "person.first_name": "Ada" }, "text")).toBe(
      "Ada",
    );
    expect(renderMerge("{{person.first_name}}", {}, "text")).toBe("");
  });

  it("escapes html mode only", () => {
    expect(renderMerge("{{x}}", { x: "<b>" }, "html")).toBe("&lt;b&gt;");
    expect(renderMerge("{{x}}", { x: "<b>" }, "text")).toBe("<b>");
  });
});

describe("sanitizeMarketingHtml", () => {
  it("removes dangerous constructs and keeps table layout with inline styles", () => {
    const input = [
      "<script>alert(1)</script>",
      "<iframe src='https://evil.example'></iframe>",
      "<form><input name='x'></form>",
      "<object data='x'></object><embed src='x'>",
      "<table><tr><td style='color:#333;background:#fff'>ok</td></tr></table>",
      "<style>body{display:none}</style>",
    ].join("");
    const { html, removed } = sanitizeMarketingHtml(input);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("<embed");
    expect(html).not.toContain("<style");
    expect(html).toContain("<table>");
    expect(html).toContain("color:#333");
    expect(removed).toContain("script");
    expect(removed).toContain("iframe");
    expect(removed).toContain("style block");
  });

  it("drops event handlers and javascript URLs", () => {
    const { html, removed } = sanitizeMarketingHtml(
      "<a href='javascript:alert(1)' onclick='alert(2)'>x</a><img src='x' onerror='alert(3)'>",
    );
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toContain("javascript:");
    expect(removed).toContain("inline event handler");
    expect(removed).toContain("javascript: URL");
  });

  it("allows a small data:image/png but drops a large one", () => {
    const small = `data:image/png;base64,${"A".repeat(400)}`;
    const big = `data:image/png;base64,${"A".repeat(60_000)}`;
    expect(sanitizeMarketingHtml(`<img src='${small}'>`).html).toContain("data:image/png");
    expect(sanitizeMarketingHtml(`<img src='${big}'>`).html).not.toContain("data:image/png");
  });
});
