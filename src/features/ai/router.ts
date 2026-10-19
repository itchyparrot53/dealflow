import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "@/config/env";
import { ERROR_IDS } from "@/constants/errorIds";
import { getWorkspace } from "@/features/deal-workspace/summaryRepo";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getAiSettings } from "./aiSettings";
import { readDealAiInsight } from "./dealInsights";
import { getAiProvider } from "./provider";
import type { AiProvider } from "./types";
import { getUsage } from "./usage";

const SIG = (): AbortSignal => AbortSignal.timeout(5_000);

// The public surface is three kinds; a scripted provider (tests) behaves like the fake.
function providerKind(provider: AiProvider | null): "openrouter" | "fake" | "none" {
  if (provider === null) return "none";
  return provider.kind === "openrouter" ? "openrouter" : "fake";
}

export const aiRouter = router({
  // Any signed-in user: the top bar and the deal card need to know whether AI is usable.
  status: protectedProcedure.query(async ({ ctx }) => {
    const provider = getAiProvider();
    const settings = await getAiSettings(ctx.db, SIG());
    return {
      available: provider !== null,
      enabled: settings.enabled,
      providerKind: providerKind(provider),
    };
  }),

  // The cached insight for one deal, after the same visibility check the deal page uses.
  dealInsight: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspace = await getWorkspace(ctx.db, ctx.actor, input.dealId, SIG());
      if (!workspace.ok) return null;
      return readDealAiInsight(ctx.db, input.dealId, SIG());
    }),

  // Admins only: provider, real usage and the configured caps for Settings, then AI.
  overview: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.actor.type !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: ERROR_IDS.PERM_DENIED });
    }
    const [settings, usage] = await Promise.all([
      getAiSettings(ctx.db, SIG()),
      getUsage(ctx.db, SIG()),
    ]);
    return {
      settings,
      usage,
      model: env.OPENROUTER_MODEL,
      providerKind: providerKind(getAiProvider()),
    };
  }),
});
