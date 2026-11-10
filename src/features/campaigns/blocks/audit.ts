import type { CampaignDocument, LeafCampaignBlock } from "./schema";

// The document facts the Review step needs (6.6): images without alt text and buttons without a
// destination. The schema already rejects an empty URL, so the button count is a safety net for a
// stored document that predates a schema change.

export interface DocumentAudit {
  imagesWithoutAlt: number;
  buttonsWithoutUrl: number;
}

function auditLeaf(block: LeafCampaignBlock, audit: DocumentAudit): void {
  if (block.type === "image" && block.alt.trim() === "") audit.imagesWithoutAlt += 1;
  if (block.type === "button" && block.href.trim() === "") audit.buttonsWithoutUrl += 1;
}

export function auditDocument(doc: CampaignDocument): DocumentAudit {
  const audit: DocumentAudit = { imagesWithoutAlt: 0, buttonsWithoutUrl: 0 };
  for (const block of doc.blocks) {
    if (block.type === "columns") {
      for (const column of block.columns) for (const inner of column) auditLeaf(inner, audit);
    } else if (block.type !== "header") {
      auditLeaf(block, audit);
    }
  }
  return audit;
}
