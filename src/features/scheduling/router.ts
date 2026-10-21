import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listAssignableUsers } from "@/features/identity/users.service";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getPage, listActivityTypesForPicker, listAllPages, listMyPages } from "./bookingPages";

// Booking-page reads. Mutations are server actions; the service enforces owner or admin.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

export const schedulingRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    return listMyPages(ctx.db, ctx.actor, SIG());
  }),

  all: protectedProcedure.query(async ({ ctx }) => {
    const result = await listAllPages(ctx.db, ctx.actor, SIG());
    if (!result.ok) throw new TRPCError({ code: "FORBIDDEN", message: result.error.id });
    return result.value;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await getPage(ctx.db, ctx.actor, input.id, SIG());
      if (!result.ok) {
        const code = result.error.id === "E_BOOKING_001" ? "NOT_FOUND" : "FORBIDDEN";
        throw new TRPCError({ code, message: result.error.id });
      }
      return result.value;
    }),

  options: protectedProcedure.query(async ({ ctx }) => {
    const signal = SIG();
    const [activityTypes, users] = await Promise.all([
      listActivityTypesForPicker(ctx.db, signal),
      listAssignableUsers(ctx.db, signal),
    ]);
    return { activityTypes, users };
  }),
});
