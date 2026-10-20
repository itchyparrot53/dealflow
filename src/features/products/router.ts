import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@/db/client";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { listDealLines } from "./dealProducts";
import { getDealTerms } from "./dealTerms";
import { getProduct, listProducts } from "./products";

// Catalog reads. Any signed-in user may browse active products (the deal page's
// add-product combobox needs them); mutations are admin-gated in products.ts.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

const listInput = z.object({
  search: z.string().max(100).optional(),
  includeInactive: z.boolean().optional(),
});

const getInput = z.object({ id: z.string().uuid() });

export const productsRouter = router({
  list: protectedProcedure
    .input(listInput)
    .query(async ({ input }) => listProducts(db, input, SIG())),
  get: protectedProcedure
    .input(getInput)
    .query(async ({ input }) => getProduct(db, input.id, SIG())),
  dealTerms: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await getDealTerms(ctx.db, ctx.actor, input.dealId, SIG());
      if (!result.ok) throw new TRPCError({ code: "NOT_FOUND", message: result.error.id });
      return result.value;
    }),
  dealLines: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await listDealLines(ctx.db, ctx.actor, input.dealId, SIG());
      if (!result.ok) throw new TRPCError({ code: "NOT_FOUND", message: result.error.id });
      return result.value;
    }),
});
