import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getDocument, listDocumentsForActor, listDocumentsForDeal } from "./documents";
import { getDocumentSettings } from "./settings";
import { listTemplates } from "./templates";

// Document reads. Templates and settings are readable by any signed-in user
// (the deal page's "New quote" dialog picks a template and the public page needs
// the company block); mutations are gated in the services by documents.manage or
// by the deal's edit rights.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

function notFound(errorId: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: errorId });
}

export const documentsRouter = router({
  settings: protectedProcedure.query(({ ctx }) => getDocumentSettings(ctx.db, SIG())),
  templates: protectedProcedure
    .input(z.object({ kind: z.enum(["quote", "invoice"]) }))
    .query(({ ctx, input }) => listTemplates(ctx.db, input.kind, SIG())),
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await getDocument(ctx.db, ctx.actor, input.id, SIG());
      if (!result.ok) throw notFound(result.error.id);
      return result.value;
    }),
  forDeal: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await listDocumentsForDeal(ctx.db, ctx.actor, input.dealId, SIG());
      if (!result.ok) throw notFound(result.error.id);
      return result.value;
    }),
  list: protectedProcedure
    .input(
      z
        .object({
          kind: z.enum(["quote", "invoice"]).optional(),
          status: z
            .enum(["draft", "sent", "viewed", "accepted", "declined", "overdue", "paid", "void"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const result = await listDocumentsForActor(ctx.db, ctx.actor, SIG());
      if (!result.ok) throw notFound(result.error.id);
      const rows = result.value;
      return {
        rows: rows.filter(
          (row) =>
            (input?.kind === undefined || row.kind === input.kind) &&
            (input?.status === undefined || row.status === input.status),
        ),
        // Kept as the full visible set so the caller can compute the outstanding
        // total without a second read.
        all: rows,
      };
    }),
});
