import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { automationRuns } from "@/db/schema";
import { can } from "@/features/permissions/can";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getAutomation, listAutomations } from "./service";

// Automation reads. Mutations are server actions; the service enforces automations.manage.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

function requireAdmin(actor: Parameters<typeof can>[0]): void {
  if (!can(actor, "automations.manage")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "E_PERM_001" });
  }
}

export const automationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.actor);
    return listAutomations(ctx.db, SIG());
  }),
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.actor);
      const row = await getAutomation(ctx.db, input.id, SIG());
      if (row === null) throw new TRPCError({ code: "NOT_FOUND", message: "E_AUTOMATION_001" });
      return row;
    }),
  runs: protectedProcedure
    .input(z.object({ automationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.actor);
      const rows = await ctx.db
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.automationId, input.automationId))
        .orderBy(desc(automationRuns.startedAt))
        .limit(100);
      return rows;
    }),
});
