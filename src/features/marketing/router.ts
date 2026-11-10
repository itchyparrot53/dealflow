import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getPersonMarketingView } from "./queries";

export const marketingRouter = router({
  // The person Marketing sidebar section. Returns null for a person the actor cannot see, so the
  // panel hides instead of rendering an empty consent trail.
  getPerson: protectedProcedure
    .input(z.object({ personId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      getPersonMarketingView(ctx.db, ctx.actor, input.personId, AbortSignal.timeout(10_000)),
    ),
});
