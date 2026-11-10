import { sanitizeMarketingHtml } from "../../blocks/sanitizeMarketing";
import type { CampaignDocument } from "../../blocks/schema";

// "Import HTML" (6.6): sanitise once, append the block, and hand the removed tag names back so the
// dialog can say what was stripped instead of silently changing the author's markup.

export interface ImportResult {
  doc: CampaignDocument | null;
  removed: string[];
}

export function importHtmlBlock(doc: CampaignDocument, html: string, id: string): ImportResult {
  const trimmed = html.trim();
  if (trimmed === "") return { doc: null, removed: [] };
  const { html: safe, removed } = sanitizeMarketingHtml(trimmed);
  if (safe.trim() === "") return { doc: null, removed };
  return {
    doc: { ...doc, blocks: [...doc.blocks, { id, type: "html", html: safe }] },
    removed,
  };
}
