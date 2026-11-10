import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { campaignAssets, campaignSettings } from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { type CampaignMime, campaignAssetUrl } from "./assets";
import { renderCampaign } from "./blocks/render";
import { campaignDocumentSchema } from "./blocks/schema";
import { listCampaignTemplates } from "./templates";

// The builder's server reads. The preview is rendered server-side so the iframe receives finished
// HTML with no client renderer to keep in sync with the real send path.

function requireView(actor: PermSetUser): void {
  if (!can(actor, "campaigns.view")) {
    throw new AppError(ERROR_IDS.PERM_DENIED, "campaigns.view required", { userId: actor.id });
  }
}

// Sample merge values so the builder shows a filled-in document instead of raw tokens.
function previewValues(companyName: string): Record<string, string> {
  return {
    "person.first_name": "Aria",
    "person.last_name": "Reyes",
    "person.name": "Aria Reyes",
    "person.email": "aria@example.com",
    "organization.name": "Northwind Studio",
    "owner.name": "Demo Admin",
    "owner.email": "admin@example.com",
    "company.name": companyName,
    unsubscribe_url: `${env.BASE_URL}/u/preview`,
    web_version_url: `${env.BASE_URL}/v/preview`,
  };
}

export const campaignsRouter = router({
  preview: protectedProcedure
    .input(
      z.object({ document: campaignDocumentSchema, preheader: z.string().max(140).optional() }),
    )
    .query(async ({ ctx, input }) => {
      requireView(ctx.actor);
      const design = await getEmailDesign(ctx.db, AbortSignal.timeout(5_000));
      const assets = await ctx.db
        .select({ id: campaignAssets.id, mime: campaignAssets.mime })
        .from(campaignAssets);
      const urls = new Map(
        assets.map((asset) => [
          asset.id,
          new URL(campaignAssetUrl(asset.id, asset.mime as CampaignMime), env.BASE_URL).toString(),
        ]),
      );
      const [settings] = await ctx.db
        .select({ postalAddress: campaignSettings.postalAddress })
        .from(campaignSettings)
        .where(eq(campaignSettings.id, 1))
        .limit(1);
      const rendered = renderCampaign(input.document, {
        design,
        values: previewValues(design.displayName),
        postalAddress: settings?.postalAddress ?? design.addressLines.join("\n"),
        baseUrl: env.BASE_URL,
        assetUrl: (assetId) => urls.get(assetId) ?? null,
        preheader: input.preheader,
        preview: true,
      });
      return {
        html: rendered.html,
        bytes: rendered.bytes,
        warning: rendered.warning,
        overLimit: rendered.overLimit,
      };
    }),

  templates: protectedProcedure.query(async ({ ctx }) => {
    requireView(ctx.actor);
    return listCampaignTemplates(ctx.db, AbortSignal.timeout(10_000));
  }),

  listAssets: protectedProcedure.query(async ({ ctx }) => {
    requireView(ctx.actor);
    const rows = await ctx.db
      .select({
        id: campaignAssets.id,
        mime: campaignAssets.mime,
        width: campaignAssets.width,
        height: campaignAssets.height,
      })
      .from(campaignAssets)
      .orderBy(campaignAssets.createdAt);
    return rows.map((row) => ({
      id: row.id,
      mime: row.mime,
      width: row.width ?? 0,
      height: row.height ?? 0,
      url: campaignAssetUrl(row.id, row.mime as CampaignMime),
    }));
  }),
});
