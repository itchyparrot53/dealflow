import { env } from "@/config/env";

// The email header uses the horizontal colour PNG because mail clients cannot be trusted with an
// SVG. It is served from public/brand, and the absolute URL is built from the configured app base
// URL so the image resolves from any recipient's mail client.
export const EMAIL_LOGO_PATH = "/brand/email-logo@2x.png";
export const EMAIL_LOGO_WIDTH = 160;
// The master is 480x100, so 160 px wide is 33.33 px high.
export const EMAIL_LOGO_HEIGHT = 33;

export function emailLogoUrl(): string {
  return new URL(EMAIL_LOGO_PATH, env.BASE_URL).toString();
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// A block-level image with no border, sized by attributes so clients that strip CSS still show
// the right dimensions. The empty margin keeps the same 24 px rhythm as the app cards.
export function emailBrandHeaderHtml(): string {
  const src = escapeAttribute(emailLogoUrl());
  return `<p style="margin:0 0 24px"><img src="${src}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="Dealflow" style="display:block;width:${EMAIL_LOGO_WIDTH}px;height:auto;border:0" /></p>`;
}

// The plain-text part cannot show an image, so it leads with the product name as the fallback.
export function emailBrandHeaderText(): string {
  return "Dealflow\n\n";
}
