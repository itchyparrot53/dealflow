import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { automationRuns } from "@/db/schema";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getAutomation, listAutomations } from "./service";

// Automation reads. Mutations are server actions; the service enforces automations.manage.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

export const automationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listAutomations(ctx.db, SIG())),
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await getAutomation(ctx.db, input.id, SIG());
      if (row === null) throw new TRPCError({ code: "NOT_FOUND", message: "E_AUTOMATION_001" });
      return row;
    }),
  runs: protectedProcedure
    .input(z.object({ automationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, input.automationId))
        .orderBy(desc(automationRuns.startedAt))
        .limit(100);
      return rows;
    }),
});
