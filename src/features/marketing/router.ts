import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { personMarketing } from "@/db/schema";
import { can } from "@/features/permissions/can";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getPersonMarketingView } from "./queries";

export const marketingRouter = router({
  // 6.6's header stat: subscribed contacts, information only (one tier has no caps).
  subscribedCount: protectedProcedure.query(async ({ ctx }) => {
    if (!can(ctx.actor, "campaigns.view")) return 0;
    const [row] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(personMarketing)
      .where(eq(personMarketing.status, "subscribed"));
    return row?.count ?? 0;
  }),
  // The person Marketing sidebar section. Returns null for a person the actor cannot see, so the
  // panel hides instead of rendering an empty consent trail.
  getPerson: protectedProcedure
    .input(z.object({ personId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      getPersonMarketingView(ctx.db, ctx.actor, input.personId, AbortSignal.timeout(10_000)),
    ),
});
