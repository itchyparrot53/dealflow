import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getSubscription, listDeliveries, listSubscriptions } from "./service";

// Webhook reads. Mutations are server actions; the services enforce automations.manage.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

export const webhooksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listSubscriptions(ctx.db, SIG())),
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await getSubscription(ctx.db, input.id, SIG());
      if (row === null) throw new TRPCError({ code: "NOT_FOUND", message: "E_WEBHOOK_001" });
      return row;
    }),
  deliveries: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await listDeliveries(ctx.db, ctx.actor, input.subscriptionId, SIG());
      if (!result.ok) throw new TRPCError({ code: "FORBIDDEN", message: result.error.id });
      return result.value;
    }),
});
