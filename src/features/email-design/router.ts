import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getEmailDesign } from "@/features/email-design/design";
import { isTemplateKey, sampleVariables } from "@/features/email-design/registry";
import { renderDefaultTemplate, renderSystemEmail } from "@/features/email-design/sendSystemEmail";
import { listTemplates, resolveTemplate } from "@/features/email-design/templates";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { previewDesignInputSchema, templateInputSchema, templateKeySchema } from "./schemas";

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

export const emailDesignRouter = router({
  get: protectedProcedure.query(({ ctx }) => getEmailDesign(ctx.db, SIG())),
  templates: protectedProcedure.query(({ ctx }) => listTemplates(ctx.db, SIG())),
  // Renders the quote template with the draft branding, so the Branding tab previews unsaved
  // changes. The logo URL comes from the saved design (or the response of the last upload).
  previewDesign: protectedProcedure
    .input(previewDesignInputSchema)
    .query(async ({ ctx, input }) => {
      const current = await getEmailDesign(ctx.db, SIG());
      const logo =
        input.logoUrl === undefined
          ? current.logo
          : {
              url: input.logoUrl,
              width: current.logo?.width ?? 240,
              height: current.logo?.height ?? 60,
            };
      const design = {
        ...current,
        displayName: input.displayName ?? current.displayName,
        accentColor: input.accentColor,
        showAddress: input.showAddress,
        footerText: input.footerText,
        showPoweredBy: input.showPoweredBy,
        newEmailLayout: input.newEmailLayout,
        replyLayout: input.replyLayout,
        footerOnReplies: input.footerOnReplies,
        logo,
      };
      const rendered = renderDefaultTemplate("quote_sent", sampleVariables("quote_sent"), design);
      return { html: rendered.html };
    }),
  template: protectedProcedure
    .input(z.object({ key: templateKeySchema }))
    .query(async ({ ctx, input }) => {
      if (!isTemplateKey(input.key))
        throw new TRPCError({ code: "NOT_FOUND", message: "unknown template key" });
      const result = await resolveTemplate(ctx.db, input.key, SIG());
      if (!result.ok) throw new TRPCError({ code: "NOT_FOUND", message: result.error.id });
      return result.value;
    }),
  previewTemplate: protectedProcedure
    .input(z.object({ key: templateKeySchema, input: templateInputSchema }))
    .query(async ({ ctx, input }) => {
      if (!isTemplateKey(input.key))
        throw new TRPCError({ code: "NOT_FOUND", message: "unknown template key" });
      const design = await getEmailDesign(ctx.db, SIG());
      const rendered = renderSystemEmail(
        input.key,
        input.input,
        sampleVariables(input.key),
        design,
      );
      return { html: rendered.html, subject: rendered.subject };
    }),
  // Composer preview (Task 3.3): the exact HTML the customer would receive for this body.
  previewCustomer: protectedProcedure
    .input(
      z.object({
        bodyHtml: z.string().max(20_000),
        signatureId: z.string().uuid().optional(),
        layout: z.enum(["branded", "minimal", "plain"]).optional(),
        threadId: z.string().uuid().optional(),
        subject: z.string().max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { renderCustomerPreview } = await import("./preview");
      return renderCustomerPreview(ctx.db, ctx.actor.id, input, SIG());
    }),
});
