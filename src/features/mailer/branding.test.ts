import { describe, expect, it } from "vitest";
import {
  EMAIL_LOGO_HEIGHT,
  EMAIL_LOGO_WIDTH,
  emailBrandHeaderHtml,
  emailBrandHeaderText,
  emailLogoUrl,
} from "./branding";

describe("email brand header", () => {
  it("builds the absolute logo URL from the app base URL", () => {
    expect(emailLogoUrl()).toBe("https://app.example.com/brand/email-logo@2x.png");
  });

  it("renders the 160 px logo with the alt text and its aspect-ratio height", () => {
    const html = emailBrandHeaderHtml();
    expect(html).toContain('src="https://app.example.com/brand/email-logo@2x.png"');
    expect(html).toContain(`width="${EMAIL_LOGO_WIDTH}"`);
    expect(html).toContain(`height="${EMAIL_LOGO_HEIGHT}"`);
    expect(html).toContain('alt="Dealflow"');
    // 480x100 master at 160 px wide.
    expect(EMAIL_LOGO_WIDTH / EMAIL_LOGO_HEIGHT).toBeCloseTo(4.8, 1);
  });

  it("carries the text-only fallback", () => {
    expect(emailBrandHeaderText()).toBe("Dealflow\n\n");
  });
});
