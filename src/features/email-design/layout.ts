import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { EMAIL_COLORS, EMAIL_FONT_STACK, type EmailDesign } from "./tokens";
import { escapeHtml } from "./variables";

// The one place email HTML is built (PLAN-PART13 6.2). Table-based, inline-styled, 600 px wide,
// Outlook-safe, with a plain-text alternative. Nothing here interpolates unsanitised content:
// bodyHtml is the caller's sanitised content and every other value is escaped in this file.

export type EmailFamily = "product" | "customer";
export type EmailLayout = "branded" | "minimal";

export interface EmailSummary {
  rows: { label: string; value: string }[];
}

export interface RenderEmailInput {
  family: EmailFamily;
  layout: EmailLayout;
  design: EmailDesign;
  preheader?: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  summary?: EmailSummary;
  footerExtraHtml?: string;
  // Not in 6.2's interface, but 6.2 asks the skeleton for a <title> with the subject; the input
  // type omitted it, so it is optional here and defaults to the display name.
  subject?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const MAX_BYTES = 90 * 1024;
const CTA_FALLBACK = "If the button doesn't work, copy this link into your browser:";

const CONTENT_STYLES: Record<string, string> = {
  p: `margin:0 0 16px;`,
  a: "text-decoration:underline;",
  h1: "margin:0 0 16px;font-size:22px;line-height:30px;font-weight:600;",
  h2: "margin:0 0 16px;font-size:18px;line-height:26px;font-weight:600;",
  ul: "margin:0 0 16px;padding-left:22px;",
  ol: "margin:0 0 16px;padding-left:22px;",
  li: "margin:0 0 6px;",
  img: "max-width:100%;height:auto;border:0;",
  blockquote: "margin:0 0 16px;padding:0 0 0 12px;border-left:3px solid #E3E3E3;",
};

function addContentStyles(html: string, accent: string): string {
  return html.replace(
    /<(p|a|h1|h2|ul|ol|li|img|blockquote)(\s[^>]*)?>/gi,
    (match, tag: string, attrs = "") => {
      if (/\bstyle=/.test(attrs)) return match;
      const color = tag === "a" ? `color:${accent};` : "";
      return `<${tag}${attrs} style="${CONTENT_STYLES[tag] ?? ""}${color}">`;
    },
  );
}

function logoHtml(design: EmailDesign): string {
  if (design.logo === null) {
    return `<p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:18px;font-weight:600;color:${EMAIL_COLORS.text};">${escapeHtml(design.displayName)}</p>`;
  }
  const height = 40;
  const width = Math.min(
    200,
    Math.max(1, Math.round((design.logo.width * height) / design.logo.height)),
  );
  return `<img src="${escapeHtml(design.logo.url)}" width="${width}" height="${height}" alt="${escapeHtml(design.displayName)}" style="display:block;border:0;height:${height}px;width:auto;max-width:200px;" />`;
}

function productLogo(design: EmailDesign): string {
  if (design.logo === null) return logoHtml(design);
  return `<img src="${escapeHtml(design.logo.url)}" width="${design.logo.width}" height="${design.logo.height}" alt="Dealflow" style="display:block;border:0;width:${design.logo.width}px;height:auto;" />`;
}

function footerLines(design: EmailDesign, family: EmailFamily, extraHtml?: string): string[] {
  if (family === "product") {
    const lines = [`Sent by Dealflow for ${escapeHtml(design.displayName)}.`];
    if (extraHtml !== undefined && extraHtml !== "") lines.push(extraHtml);
    return lines;
  }
  const lines: string[] = [escapeHtml(design.displayName)];
  if (design.showAddress) {
    for (const line of design.addressLines) lines.push(escapeHtml(line));
  }
  if (design.footerText !== null && design.footerText.trim() !== "") {
    lines.push(escapeHtml(design.footerText).replace(/\n/g, "<br>"));
  }
  if (design.showPoweredBy) lines.push("Powered by Dealflow");
  return lines;
}

function footerHtml(design: EmailDesign, family: EmailFamily, extraHtml?: string): string {
  const lines = footerLines(design, family, extraHtml);
  const body = lines.map((line) => `<div style="margin:0 0 2px;">${line}</div>`).join("");
  return `<div style="font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:18px;color:${EMAIL_COLORS.muted};">${body}</div>`;
}

function summaryHtml(summary: EmailSummary | undefined, design: EmailDesign): string {
  if (summary === undefined || summary.rows.length === 0) return "";
  const rows = summary.rows
    .map(
      (row) =>
        `<tr><td style="padding:4px 0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:${EMAIL_COLORS.muted};">${escapeHtml(row.label)}</td><td align="right" style="padding:4px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:20px;font-weight:600;color:${EMAIL_COLORS.text};">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;background:${EMAIL_COLORS.summary};border-radius:6px;"><tr><td style="padding:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
}

function buttonHtml(cta: { label: string; url: string }, design: EmailDesign): string {
  const url = escapeHtml(cta.url);
  const label = escapeHtml(cta.label);
  const accent = escapeHtml(design.accentColor);
  const vml = `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${accent}" fillcolor="${accent}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->`;
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;"><tr><td align="center" bgcolor="${accent}" style="border-radius:6px;">`,
    `<a href="${url}" style="display:inline-block;padding:12px 22px;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;background:${accent};">${label}</a>`,
    "</td></tr></table>",
    vml,
    `<p style="margin:12px 0 16px;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:${EMAIL_COLORS.muted};">${CTA_FALLBACK}<br><a href="${url}" style="color:${accent};word-break:break-all;">${url}</a></p>`,
  ].join("");
}

function brandedBody(
  design: EmailDesign,
  family: EmailFamily,
  bodyHtml: string,
  sections: string,
  footer: string,
): string {
  const header = family === "product" ? productLogo(design) : logoHtml(design);
  return [
    `<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->`,
    `<table role="presentation" data-df-layout="${family}-branded" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_COLORS.page};">`,
    `<tr><td align="center" style="padding:32px 12px;">`,
    `<table role="presentation" class="df-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${EMAIL_COLORS.white};border:1px solid ${EMAIL_COLORS.border};border-radius:8px;">`,
    `<tr><td class="df-pad" style="padding:28px 32px 8px;">${header}</td></tr>`,
    `<tr><td class="df-pad" style="padding:16px 32px 8px;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:${EMAIL_COLORS.text};">${bodyHtml}${sections}</td></tr>`,
    `<tr><td class="df-pad" style="padding:24px 32px 28px;border-top:1px solid ${EMAIL_COLORS.footerRule};">${footer}</td></tr>`,
    "</table></td></tr></table>",
    `<!--[if mso]></td></tr></table><![endif]-->`,
  ].join("");
}

function minimalBody(design: EmailDesign, bodyHtml: string, footer: string | null): string {
  const footerRow =
    footer === null
      ? ""
      : `<tr><td style="padding:16px 0 0;border-top:1px solid ${EMAIL_COLORS.footerRule};">${footer}</td></tr>`;
  return [
    `<table role="presentation" data-df-layout="customer-minimal" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_COLORS.white};">`,
    `<tr><td style="padding:24px 16px;">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">`,
    `<tr><td style="font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:${EMAIL_COLORS.text};">${bodyHtml}</td></tr>`,
    footerRow,
    "</table></td></tr></table>",
  ].join("");
}

function documentShell(
  title: string,
  preheader: string | undefined,
  body: string,
  background: string,
): string {
  const preheaderHtml =
    preheader === undefined || preheader === ""
      ? ""
      : `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>@media (max-width: 620px) { .df-container { width: 100% !important; } .df-pad { padding-left: 20px !important; padding-right: 20px !important; } }</style>",
    "</head>",
    `<body style="margin:0;padding:0;background:${background};">`,
    preheaderHtml,
    body,
    "</body>",
    "</html>",
  ].join("");
}

export function contrastRatio(foreground: string, background: string): number {
  const toRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    return [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  };
  const luminance = (hex: string): number => {
    const [red = 0, green = 0, blue = 0] = toRgb(hex).map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => ENTITIES[match] ?? match);
}

export function htmlToText(html: string): string {
  const withLinks = html.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, label: string) => `${label.replace(/<[^>]+>/g, "")} (${href})`,
  );
  const flattened = withLinks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|div|blockquote|tr)>/gi, "\n\n")
    .replace(/<\/(li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(flattened)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainFooter(design: EmailDesign, family: EmailFamily, extraHtml?: string): string[] {
  if (family === "product") {
    const lines = [`Sent by Dealflow for ${design.displayName}.`];
    if (extraHtml !== undefined && extraHtml !== "") lines.push(htmlToText(extraHtml));
    return lines;
  }
  const lines: string[] = [design.displayName];
  if (design.showAddress) lines.push(...design.addressLines);
  if (design.footerText !== null && design.footerText.trim() !== "") lines.push(design.footerText);
  if (design.showPoweredBy) lines.push("Powered by Dealflow");
  return lines;
}

function plainText(
  design: EmailDesign,
  family: EmailFamily,
  input: RenderEmailInput,
  includeFooter: boolean,
): string {
  const brand = family === "product" ? "Dealflow" : design.displayName;
  const lines = [brand, "", htmlToText(input.bodyHtml)];
  if (input.cta !== undefined) lines.push("", `${input.cta.label}: ${input.cta.url}`);
  if (input.summary !== undefined && input.summary.rows.length > 0) {
    lines.push("");
    for (const row of input.summary.rows) lines.push(`${row.label}: ${row.value}`);
  }
  if (includeFooter) {
    const footer = plainFooter(design, family, input.footerExtraHtml);
    if (footer.length > 0) lines.push("", "--", ...footer);
  }
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderEmail(input: RenderEmailInput): RenderedEmail {
  const layout: EmailLayout = input.family === "product" ? "branded" : input.layout;
  const body = addContentStyles(input.bodyHtml, input.design.accentColor);
  const sections = `${input.cta === undefined ? "" : buttonHtml(input.cta, input.design)}${summaryHtml(input.summary, input.design)}`;
  const includeFooter = layout === "branded" || input.design.footerOnReplies;
  const footer = footerHtml(input.design, input.family, input.footerExtraHtml);
  const bodyHtml =
    layout === "branded"
      ? brandedBody(input.design, input.family, body, sections, footer)
      : minimalBody(input.design, body, input.design.footerOnReplies ? footer : null);
  const html = documentShell(
    input.subject ?? input.design.displayName,
    input.preheader,
    bodyHtml,
    layout === "branded" ? EMAIL_COLORS.page : EMAIL_COLORS.white,
  );
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_BYTES) {
    if (input.family === "product") {
      throw new AppError(ERROR_IDS.EMAIL_DESIGN_TOO_LARGE, "rendered email exceeds 90 KB", {
        bytes,
      });
    }
    console.warn("email.layout_too_large", { family: input.family, bytes });
  }
  return { html, text: plainText(input.design, input.family, input, includeFooter) };
}
