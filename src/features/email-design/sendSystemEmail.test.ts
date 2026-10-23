import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_KEYS, sampleVariables } from "./registry";
import { renderDefaultTemplate } from "./sendSystemEmail";
import type { EmailDesign } from "./tokens";

const CUSTOMER: EmailDesign = {
  displayName: "Northwind Studio",
  accentColor: "#1F5FBF",
  logo: {
    url: "https://app.example.com/email-assets/logo/0123456789abcdef.png",
    width: 240,
    height: 60,
  },
  showAddress: true,
  addressLines: ["12 Harbour Road", "Bristol BS1 4RN"],
  footerText: "Sent by Northwind Studio.",
  showPoweredBy: false,
  newEmailLayout: "branded",
  replyLayout: "minimal",
  footerOnReplies: false,
};

describe("registry defaults", () => {
  it("renders every key with its sample variables under the 90 KB guard and no token left", () => {
    for (const key of EMAIL_TEMPLATE_KEYS) {
      const rendered = renderDefaultTemplate(key, sampleVariables(key), CUSTOMER);
      expect(rendered.subject, key).not.toContain("{{");
      expect(rendered.subject, key).not.toMatch(/[\r\n]/);
      expect(rendered.html, key).not.toContain("{{");
      expect(rendered.text, key).not.toContain("{{");
      expect(Buffer.byteLength(rendered.html, "utf8"), key).toBeLessThan(90 * 1024);
      expect(rendered.html, key).toContain("data-df-layout=");
    }
  });

  it("renders product mail with the Dealflow mark and the company name in the footer", () => {
    const rendered = renderDefaultTemplate(
      "sign_in_link",
      sampleVariables("sign_in_link"),
      CUSTOMER,
    );
    expect(rendered.html).toContain('alt="Dealflow"');
    expect(rendered.html).toContain("Sent by Dealflow for Northwind Studio.");
    expect(rendered.html).toContain('data-df-layout="product-branded"');
  });

  it("renders customer mail with the company identity and at most one marker", () => {
    const rendered = renderDefaultTemplate("quote_sent", sampleVariables("quote_sent"), CUSTOMER);
    expect(rendered.html).toContain('data-df-layout="customer-branded"');
    expect(rendered.html.match(/data-df-layout=/g)).toHaveLength(1);
    expect(rendered.html).toContain("Northwind Studio");
    expect(rendered.html).toContain("Q-2026-0003");
    expect(rendered.html).toContain("£1,200.00");
    expect(rendered.html).toContain(">View quote</a>");
  });

  it("renders the notification button label from the type's CTA", () => {
    const rendered = renderDefaultTemplate(
      "notification",
      sampleVariables("notification"),
      CUSTOMER,
    );
    expect(rendered.html).toContain(">Open deal</a>");
    expect(rendered.html).toContain("Change notification settings");
  });
});
