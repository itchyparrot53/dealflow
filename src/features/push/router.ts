import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getPushPrefs } from "./prefs";
import { listMySubscriptions } from "./subscriptions";
import { publicPushConfig } from "./vapid";

const SIG = (): AbortSignal => AbortSignal.timeout(10_000);

// Reads only. Every push change goes through the CSRF-checked server actions in actions.ts.
export const pushRouter = router({
  // The client needs the application server key to subscribe. The private key and subject stay
  // in the server env and are never part of this payload.
  config: protectedProcedure.query(() => publicPushConfig()),

  subscriptions: protectedProcedure.query(({ ctx }) =>
    listMySubscriptions(ctx.db, ctx.actor.id, SIG()),
  ),

  preferences: protectedProcedure.query(({ ctx }) => getPushPrefs(ctx.db, ctx.actor.id, SIG())),
});
