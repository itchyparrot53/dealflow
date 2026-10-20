import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getDocumentSettings } from "./settings";
import { listTemplates } from "./templates";

// Document configuration reads. Templates are readable by any signed-in user
// because the deal page's "New quote" dialog picks one; mutations are gated in
// templates.ts and settings.ts by documents.manage.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

export const documentsRouter = router({
  settings: protectedProcedure.query(({ ctx }) => getDocumentSettings(ctx.db, SIG())),
  templates: protectedProcedure
    .input(z.object({ kind: z.enum(["quote", "invoice"]) }))
    .query(({ ctx, input }) => listTemplates(ctx.db, input.kind, SIG())),
});
