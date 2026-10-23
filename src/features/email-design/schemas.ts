import { z } from "zod";

// Boundary schemas for the email-design settings (PLAN-PART13 6.7). The services re-check the
// accent contrast and the template key; these only enforce shape and length.

export const designInputSchema = z.object({
  displayName: z.string().trim().max(200).nullable(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .max(7),
  showAddress: z.boolean(),
  footerText: z.string().max(500).nullable(),
  showPoweredBy: z.boolean(),
  newEmailLayout: z.enum(["branded", "plain"]),
  replyLayout: z.enum(["minimal", "branded", "plain"]),
  footerOnReplies: z.boolean(),
});

export const previewDesignInputSchema = designInputSchema.extend({
  logoUrl: z.string().url().max(500).optional(),
});

export const templateInputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().max(140).nullable(),
  bodyHtml: z.string().min(1).max(20_000),
  ctaLabel: z.string().max(40).nullable(),
});

export const templateKeySchema = z.string().min(1).max(80);

export type DesignInput = z.infer<typeof designInputSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
