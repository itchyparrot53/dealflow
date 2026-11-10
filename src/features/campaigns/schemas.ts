import { z } from "zod";
import { CAMPAIGN_TYPES } from "@/constants/campaigns";
import { personFilterSchema } from "@/features/contacts/contactFilter";
import { campaignDocumentSchema } from "./blocks/schema";

// Boundary shapes for the campaign editor and its actions (3.1).

export const campaignSegmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved_filter"), savedFilterId: z.string().uuid() }),
  z.object({ kind: z.literal("definition"), definition: personFilterSchema }),
]);

export type CampaignSegment = z.infer<typeof campaignSegmentSchema>;

const name = z.string().trim().min(1).max(120);
const subject = z.string().max(200);

export const campaignCreateInput = z.object({
  name: name.default("Untitled campaign"),
  type: z.enum(CAMPAIGN_TYPES).default("newsletter"),
  subject: subject.default(""),
  preheader: z.string().max(140).nullable().default(null),
  templateId: z.string().uuid().nullable().default(null),
  content: campaignDocumentSchema.nullable().default(null),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateInput>;

export const campaignUpdateInput = z.object({
  id: z.string().uuid(),
  name: name.optional(),
  type: z.enum(CAMPAIGN_TYPES).optional(),
  subject: subject.optional(),
  preheader: z.string().max(140).nullable().optional(),
  senderId: z.string().uuid().nullable().optional(),
  replyTo: z.string().email().nullable().optional(),
  segment: campaignSegmentSchema.nullable().optional(),
  content: campaignDocumentSchema.nullable().optional(),
});

export type CampaignUpdateInput = z.infer<typeof campaignUpdateInput>;
