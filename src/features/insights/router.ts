import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import type { PermSetUser } from "@/features/permissions/effective";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getDashboard, listDashboards } from "./dashboards";
import { type ReportDefinition, reportDefinitionSchema } from "./definition";
import { getReport, listReports } from "./reports";
import { runReport } from "./run";

// Insights reads. The builder previews an unsaved definition through `run`, and a saved report
// runs through the same path so its stored definition is the only source. Mutations are server
// actions with CSRF (actions.ts), which the services gate on owner-or-admin.

const SIG = (): AbortSignal => AbortSignal.timeout(20_000);

function toTrpc(errorId: string): TRPCError {
  switch (errorId) {
    case ERROR_IDS.INSIGHT_NOT_FOUND:
      return new TRPCError({ code: "NOT_FOUND", message: errorId });
    case ERROR_IDS.INSIGHT_FORBIDDEN:
      return new TRPCError({ code: "FORBIDDEN", message: errorId });
    case ERROR_IDS.INSIGHT_QUERY_TIMEOUT:
      return new TRPCError({ code: "TIMEOUT", message: errorId });
    case ERROR_IDS.INSIGHT_DEFINITION_INVALID:
    case ERROR_IDS.INSIGHT_INPUT_INVALID:
      return new TRPCError({ code: "BAD_REQUEST", message: errorId });
    default:
      return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorId });
  }
}

async function savedDefinition(
  db: Parameters<typeof getReport>[0],
  actor: PermSetUser,
  reportId: string,
  signal: AbortSignal,
): Promise<ReportDefinition> {
  const report = await getReport(db, actor, reportId, signal);
  if (!report.ok) throw toTrpc(report.error.id);
  return report.value.definition;
}

export const insightsRouter = router({
  listReports: protectedProcedure.query(async ({ ctx }) => listReports(ctx.db, ctx.actor, SIG())),

  getReport: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const result = await getReport(ctx.db, ctx.actor, input.id, SIG());
    if (!result.ok) throw toTrpc(result.error.id);
    return result.value;
  }),

  run: protectedProcedure
    .input(
      z.union([z.object({ reportId: z.uuid() }), z.object({ definition: reportDefinitionSchema })]),
    )
    .query(async ({ ctx, input }) => {
      const signal = SIG();
      const definition =
        "reportId" in input
          ? await savedDefinition(ctx.db, ctx.actor, input.reportId, signal)
          : input.definition;
      const result = await runReport(ctx.db, ctx.actor, definition, signal);
      if (!result.ok) throw toTrpc(result.error.id);
      return result.value;
    }),

  listDashboards: protectedProcedure.query(async ({ ctx }) =>
    listDashboards(ctx.db, ctx.actor, SIG()),
  ),

  getDashboard: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await getDashboard(ctx.db, ctx.actor, input.id, SIG());
      if (!result.ok) throw toTrpc(result.error.id);
      return result.value;
    }),
});
