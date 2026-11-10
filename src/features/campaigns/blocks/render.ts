import { sanitizeAuthorHtml } from "@/features/email/sanitizeHtml";
import { EMAIL_COLORS, EMAIL_FONT_STACK, type EmailDesign } from "@/features/email-design/tokens";
import { renderMerge } from "./personalize";
import { renderPlainText } from "./plainText";
import { sanitizeMarketingHtml } from "./sanitizeMarketing";
import type { CampaignBlock, CampaignDocument, LeafCampaignBlock } from "./schema";

// The campaign renderer (6.4). Separate from Part 13's renderEmail because a campaign is a
// full-width designed document, not a wrapped one-to-one message; it still reuses the design
// tokens, the MSO/VML patterns and the escaping rules.

import { CAMPAIGN_HTML_LIMIT_BYTES, CAMPAIGN_HTML_WARN_BYTES } from "@/constants/campaigns";

export interface CampaignRenderContext {
  design: EmailDesign;
  values: Readonly<Record<string, string>>;
  postalAddress: string;
  // The inbox preview line; rendered hidden at the top of the body.
  preheader?: string;
  // Builder preview only: wraps each top-level block for selection and injects a click bridge.
  preview?: boolean;
  // Absolute app origin, for the social icons under /email/social.
  baseUrl: string;
  assetUrl: (assetId: string) => string | null;
}

export interface RenderedCampaign {
  html: string;
  text: string;
  links: string[];
  bytes: number;
  warning: boolean;
  overLimit: boolean;
}

const SERIF_STACK = "Georgia, 'Times New Roman', serif";

function contentFont(settings: CampaignDocument["settings"]): string {
  return settings.fontFamily === "serif" ? SERIF_STACK : EMAIL_FONT_STACK;
}

function sizeOf(html: string): number {
  return new TextEncoder().encode(html).length;
}

// Inline the author content's default rhythm the way the Part 13 layout does, leaving any style
// the author already set alone.
function styleAuthorHtml(html: string, font: string): string {
  return html.replace(
    /<(p|a|h1|h2|ul|ol|li|blockquote)(\s[^>]*)?>/gi,
    (match: string, tag: string, attrs: string | undefined) => {
      const attributes = attrs ?? "";
      if (/\bstyle=/.test(attributes)) return match;
      const base = `font-family:${font};font-size:15px;line-height:24px;margin:0 0 16px;`;
      return `<${tag}${attributes} style="${base}">`;
    },
  );
}

function headingHtml(
  block: Extract<LeafCampaignBlock, { type: "heading" }>,
  ctx: CampaignRenderContext,
  font: string,
): string {
  const size = block.level === 1 ? "24px" : "20px";
  const line = block.level === 1 ? "32px" : "28px";
  const text = renderMerge(block.text, ctx.values, "html");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${block.align}" style="padding:8px 0 4px;font-family:${font};font-size:${size};line-height:${line};font-weight:600;color:${EMAIL_COLORS.text};">${text}</td></tr></table>`;
}

function textHtml(
  block: Extract<LeafCampaignBlock, { type: "text" }>,
  ctx: CampaignRenderContext,
  font: string,
): string {
  const sanitized = sanitizeAuthorHtml(renderMerge(block.html, ctx.values, "html"));
  return styleAuthorHtml(sanitized, font);
}

function imageHtml(
  block: Extract<LeafCampaignBlock, { type: "image" }>,
  ctx: CampaignRenderContext,
): string {
  const url = ctx.assetUrl(block.assetId);
  if (url === null) return "";
  const alt = renderMerge(block.alt, ctx.values, "html");
  const href = block.href === undefined ? null : renderMerge(block.href, ctx.values, "html");
  const img = `<img src="${url}" width="${block.width}" alt="${alt}" style="display:block;width:${block.width}px;max-width:100%;height:auto;border:0;margin:0 auto;" />`;
  const inner = href === null ? img : `<a href="${href}" target="_blank" rel="noopener">${img}</a>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${block.align}" style="padding:8px 0;">${inner}</td></tr></table>`;
}

function buttonHtml(
  block: Extract<LeafCampaignBlock, { type: "button" }>,
  ctx: CampaignRenderContext,
  font: string,
): string {
  const href = renderMerge(block.href, ctx.values, "html");
  const label = renderMerge(block.label, ctx.values, "html");
  const color = block.color ?? ctx.design.accentColor;
  const vml = `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="14%" strokecolor="${color}" fillcolor="${color}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->`;
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${block.align}" style="padding:8px 0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${color}" style="border-radius:6px;">`,
    `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:${font};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;background:${color};">${label}</a>`,
    `</td></tr></table>${vml}</td></tr></table>`,
  ].join("");
}

function socialHtml(
  block: Extract<LeafCampaignBlock, { type: "social" }>,
  ctx: CampaignRenderContext,
): string {
  const icons = block.links
    .map(
      (link) =>
        `<a href="${renderMerge(link.url, ctx.values, "html")}" target="_blank" rel="noopener" style="text-decoration:none;"><img src="${ctx.baseUrl.replace(/\/$/, "")}/email/social/${link.network}.png" width="24" height="24" alt="${link.network}" style="display:inline-block;border:0;margin:0 6px;" /></a>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:12px 0;">${icons}</td></tr></table>`;
}

function leafHtml(block: LeafCampaignBlock, ctx: CampaignRenderContext, font: string): string {
  switch (block.type) {
    case "heading":
      return headingHtml(block, ctx, font);
    case "text":
      return textHtml(block, ctx, font);
    case "image":
      return imageHtml(block, ctx);
    case "button":
      return buttonHtml(block, ctx, font);
    case "divider":
      return `<hr style="border:0;border-top:1px solid ${EMAIL_COLORS.border};margin:16px 0;" />`;
    case "spacer":
      return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</div>`;
    case "social":
      return socialHtml(block, ctx);
    case "html":
      return sanitizeMarketingHtml(renderMerge(block.html, ctx.values, "html")).html;
  }
}

function blockHtml(block: CampaignBlock, ctx: CampaignRenderContext, font: string): string {
  switch (block.type) {
    case "header": {
      const logo =
        block.logo === "company" && ctx.design.logo !== null
          ? `<img src="${ctx.design.logo.url}" width="${Math.min(200, ctx.design.logo.width)}" alt="${ctx.design.displayName}" style="display:block;border:0;max-width:200px;height:auto;" />`
          : `<span style="font-family:${font};font-size:18px;font-weight:600;color:${EMAIL_COLORS.text};">${renderMerge(ctx.design.displayName, ctx.values, "html")}</span>`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${block.align}" style="padding:8px 0 16px;">${logo}</td></tr></table>`;
    }
    case "columns": {
      const cell = (blocks: LeafCampaignBlock[]): string =>
        `<td class="df-col" width="50%" valign="top" style="width:50%;padding:0 8px;">${blocks.map((inner) => leafHtml(inner, ctx, font)).join("")}</td>`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cell(block.columns[0])}${cell(block.columns[1])}</tr></table>`;
    }
    case "heading":
    case "text":
    case "button":
    case "image":
    case "divider":
    case "spacer":
    case "social":
    case "html":
      return leafHtml(block, ctx, font);
  }
}

function footerHtml(ctx: CampaignRenderContext, font: string): string {
  const company = renderMerge(ctx.design.displayName, ctx.values, "html");
  const address =
    ctx.postalAddress.trim() === ""
      ? ""
      : `<div style="margin:0 0 4px;">${renderMerge(ctx.postalAddress, ctx.values, "html").replace(/\n/g, "<br>")}</div>`;
  const unsubscribe = renderMerge(ctx.values.unsubscribe_url ?? "", ctx.values, "html");
  const webVersion = renderMerge(ctx.values.web_version_url ?? "", ctx.values, "html");
  return [
    `<div style="font-family:${font};font-size:12px;line-height:18px;color:#65686F;text-align:center;">`,
    `<div style="margin:0 0 4px;">${company}</div>`,
    address,
    `<div style="margin:0 0 8px;">You received this email because you subscribed to ${company} updates.</div>`,
    `<div><a href="${unsubscribe}" style="color:#65686F;text-decoration:underline;">Unsubscribe</a> · <a href="${webVersion}" style="color:#65686F;text-decoration:underline;">View in browser</a></div>`,
    `</div>`,
  ].join("");
}

function headHtml(
  doc: CampaignDocument,
  title: string,
  preheader: string | undefined,
  values: Readonly<Record<string, string>>,
): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    "<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->",
    `<style>body{margin:0;padding:0;background:${doc.settings.backgroundColor};} table{border-collapse:collapse;} .df-col{padding:0 8px;}`,
    `@media only screen and (max-width:620px){.df-container{width:100%!important;}.df-col{display:block!important;width:100%!important;padding:0!important;}.df-pad{padding-left:20px!important;padding-right:20px!important;}}</style>`,
    "</head><body>",
    preheader === undefined || preheader === ""
      ? ""
      : `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${renderMerge(preheader, values, "html")}</div>`,
  ].join("");
}

export function renderCampaign(
  doc: CampaignDocument,
  ctx: CampaignRenderContext,
): RenderedCampaign {
  const font = contentFont(doc.settings);
  const title = renderMerge(ctx.design.displayName, ctx.values, "html");
  const sections = doc.blocks
    .map((block) =>
      ctx.preview === true
        ? `<div data-df-block="${block.id}" style="cursor:pointer;">${blockHtml(block, ctx, font)}</div>`
        : blockHtml(block, ctx, font),
    )
    .join("");
  const html = [
    headHtml(doc, title, ctx.preheader, ctx.values),
    '<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${doc.settings.backgroundColor};">`,
    `<tr><td align="center" style="padding:24px 12px;">`,
    `<table role="presentation" class="df-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:8px;">`,
    `<tr><td class="df-pad" style="padding:32px;">${sections}</td></tr>`,
    `<tr><td class="df-pad" style="padding:0 32px 28px;">${footerHtml(ctx, font)}</td></tr>`,
    "</table></td></tr></table>",
    "<!--[if mso]></td></tr></table><![endif]-->",
    ctx.preview === true
      ? '<script>(function(){document.addEventListener("click",function(e){var n=e.target;while(n&&n!==document.body){if(n.getAttribute&&n.getAttribute("data-df-block")){parent.postMessage({type:"df-block-click",id:n.getAttribute("data-df-block")},"*");return;}n=n.parentNode;}},true);})();</script>'
      : "",
    "</body></html>",
  ].join("");

  const links: string[] = [];
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href === undefined || !/^https?:/i.test(href)) continue;
    if (href === ctx.values.unsubscribe_url || href === ctx.values.web_version_url) continue;
    if (!links.includes(href)) links.push(href);
  }

  const bytes = sizeOf(html);
  return {
    html,
    text: renderPlainText(doc, ctx),
    links,
    bytes,
    warning: bytes > CAMPAIGN_HTML_WARN_BYTES,
    overLimit: bytes > CAMPAIGN_HTML_LIMIT_BYTES,
  };
}

export function campaignSizeState(bytes: number): { warning: boolean; overLimit: boolean } {
  return {
    warning: bytes > CAMPAIGN_HTML_WARN_BYTES,
    overLimit: bytes > CAMPAIGN_HTML_LIMIT_BYTES,
  };
}
