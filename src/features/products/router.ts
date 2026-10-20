import { z } from "zod";
import { db } from "@/db/client";
import { protectedProcedure, router } from "@/server/trpc/trpc";
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
});
