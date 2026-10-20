import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { forecastInput, getForecast } from "./forecast";

const SIG = (): AbortSignal => AbortSignal.timeout(20_000);

export const forecastRouter = router({
  get: protectedProcedure.input(forecastInput).query(async ({ ctx, input }) => {
    const result = await getForecast(ctx.db, ctx.actor, input, SIG());
    if (!result.ok) throw new TRPCError({ code: "FORBIDDEN", message: result.error.id });
    return result.value;
  }),
});
