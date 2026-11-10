import { htmlToText } from "@/features/email-design/layout";
import type { EmailDesign } from "@/features/email-design/tokens";
import { renderMerge } from "./personalize";
import { sanitizeMarketingHtml } from "./sanitizeMarketing";
import type { CampaignBlock, CampaignDocument, LeafCampaignBlock } from "./schema";

// The text/plain part (6.4), built from the document rather than stripped from the HTML, so
// buttons become "Label: url" and images become "[alt]".

export interface PlainTextContext {
  design: EmailDesign;
  values: Readonly<Record<string, string>>;
  postalAddress: string;
}

export function renderPlainText(doc: CampaignDocument, ctx: PlainTextContext): string {
  const lines: string[] = [];
  const text = (value: string): string => renderMerge(value, ctx.values, "text");

  const walk = (block: CampaignBlock | LeafCampaignBlock): void => {
    switch (block.type) {
      case "header":
        lines.push(text(ctx.design.displayName));
        return;
      case "heading":
        lines.push(text(block.text).toUpperCase());
        return;
      case "text":
        lines.push(htmlToText(text(block.html)).trim());
        return;
      case "image":
        lines.push(`[${text(block.alt)}]`);
        return;
      case "button":
        lines.push(`${text(block.label)}: ${text(block.href)}`);
        return;
      case "divider":
        lines.push("---");
        return;
      case "spacer":
        lines.push("");
        return;
      case "social":
        for (const link of block.links) lines.push(`${link.network}: ${text(link.url)}`);
        return;
      case "html":
        lines.push(htmlToText(sanitizeMarketingHtml(text(block.html)).html).trim());
        return;
      case "columns":
        for (const column of block.columns) for (const inner of column) walk(inner);
        return;
    }
  };

  for (const block of doc.blocks) walk(block);
  lines.push("");
  lines.push(text(ctx.design.displayName));
  if (ctx.postalAddress.trim() !== "") lines.push(ctx.postalAddress.trim());
  lines.push(
    `You received this email because you subscribed to ${text(ctx.design.displayName)} updates.`,
  );
  lines.push(`Unsubscribe: ${ctx.values.unsubscribe_url ?? ""}`);
  lines.push(`View in browser: ${ctx.values.web_version_url ?? ""}`);
  return lines.join("\n");
}
