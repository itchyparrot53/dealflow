import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getProject, listProjects, projectStatusSchema } from "./projects";

// Project reads. Mutations are CSRF-guarded server actions (actions.ts), which the services gate
// on the owner/assignee/admin rule.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

const listInput = z
  .object({
    status: projectStatusSchema.optional(),
    ownerId: z.uuid().optional(),
    dealId: z.uuid().optional(),
    search: z.string().trim().max(200).optional(),
  })
  .optional();

function toTrpc(errorId: string): TRPCError {
  switch (errorId) {
    case ERROR_IDS.PROJECT_NOT_FOUND:
    case ERROR_IDS.PROJECT_TASK_NOT_FOUND:
      return new TRPCError({ code: "NOT_FOUND", message: errorId });
    case ERROR_IDS.PROJECT_FORBIDDEN:
      return new TRPCError({ code: "FORBIDDEN", message: errorId });
    case ERROR_IDS.PROJECT_INPUT_INVALID:
      return new TRPCError({ code: "BAD_REQUEST", message: errorId });
    default:
      return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorId });
  }
}

export const projectsRouter = router({
  list: protectedProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => listProjects(ctx.db, ctx.actor, input ?? {}, SIG())),

  get: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const result = await getProject(ctx.db, ctx.actor, input.id, SIG());
    if (!result.ok) throw toTrpc(result.error.id);
    return result.value;
  }),
});
