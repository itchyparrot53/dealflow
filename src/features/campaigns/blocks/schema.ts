import { z } from "zod";

// The campaign block document (PLAN-PART14 6.4). Versioned so a stored document keeps rendering
// after the schema grows: version 1 is the only shape today, and the columns block cannot nest.

export const CAMPAIGN_DOC_VERSION = 1;
export const CAMPAIGN_CONTENT_WIDTH = 600;
export const CAMPAIGN_IMAGE_MAX_WIDTH = 600;

const HEX = /^#[0-9A-Fa-f]{6}$/;
const hex = z.string().regex(HEX, "Use a six-digit hex colour");
const align = z.enum(["left", "center", "right"]);
const blockId = z.string().min(1).max(64);

const linkUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => /^(https?:\/\/|mailto:)/i.test(value), "Use an http(s) or mailto URL");

export const campaignSettingsSchema = z.object({
  backgroundColor: hex.default("#F4F4F2"),
  // Fixed: the design widths in 6.4 are 600 px desktop, one column on mobile.
  contentWidth: z.literal(CAMPAIGN_CONTENT_WIDTH).default(CAMPAIGN_CONTENT_WIDTH),
  fontFamily: z.enum(["system", "serif"]).default("system"),
  linkColor: hex.default("#2D8548"),
});

export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;

// Blocks that may sit inside a two-column block. A columns block is deliberately absent: 6.4
// forbids nesting them.
const leafBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: blockId,
    type: z.literal("heading"),
    text: z.string().max(300),
    level: z.union([z.literal(1), z.literal(2)]),
    align: align.default("left"),
  }),
  z.object({ id: blockId, type: z.literal("text"), html: z.string().max(50_000) }),
  z.object({
    id: blockId,
    type: z.literal("image"),
    assetId: z.string().uuid(),
    alt: z.string().max(300),
    width: z.number().int().min(1).max(CAMPAIGN_IMAGE_MAX_WIDTH),
    href: linkUrl.optional(),
    align: align.default("center"),
  }),
  z.object({
    id: blockId,
    type: z.literal("button"),
    label: z.string().trim().min(1).max(80),
    href: linkUrl,
    color: hex.optional(),
    align: align.default("left"),
  }),
  z.object({ id: blockId, type: z.literal("divider") }),
  z.object({
    id: blockId,
    type: z.literal("spacer"),
    height: z.union([z.literal(8), z.literal(16), z.literal(24), z.literal(32), z.literal(48)]),
  }),
  z.object({
    id: blockId,
    type: z.literal("social"),
    links: z
      .array(
        z.object({
          network: z.enum(["linkedin", "x", "facebook", "instagram", "youtube", "website"]),
          url: linkUrl,
        }),
      )
      .max(6),
  }),
  z.object({ id: blockId, type: z.literal("html"), html: z.string().max(100_000) }),
]);

export type LeafCampaignBlock = z.infer<typeof leafBlockSchema>;

export const campaignBlockSchema = z.union([
  z.object({
    id: blockId,
    type: z.literal("header"),
    logo: z.enum(["company", "none"]),
    align: align.default("left"),
  }),
  leafBlockSchema,
  z.object({
    id: blockId,
    type: z.literal("columns"),
    columns: z.tuple([z.array(leafBlockSchema).max(10), z.array(leafBlockSchema).max(10)]),
  }),
]);

export type CampaignBlock = z.infer<typeof campaignBlockSchema>;

export const campaignDocumentSchema = z.object({
  version: z.literal(CAMPAIGN_DOC_VERSION),
  settings: campaignSettingsSchema,
  blocks: z.array(campaignBlockSchema).max(100),
});

export type CampaignDocument = z.infer<typeof campaignDocumentSchema>;

export function isCampaignDocument(value: unknown): value is CampaignDocument {
  return campaignDocumentSchema.safeParse(value).success;
}
