import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { pipelines, stages, users } from "@/db/schema";
import { can } from "@/features/permissions/can";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { getForm, listEligibleCustomFields, listForms, listSubmissions } from "./forms";

// Form reads. Mutations are server actions; the service enforces forms.manage.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

function requireAdmin(actor: Parameters<typeof can>[0]): void {
  if (!can(actor, "forms.manage")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "E_PERM_001" });
  }
}

function requireFound<T>(value: T | null): T {
  if (value === null) throw new TRPCError({ code: "NOT_FOUND", message: "E_FORM_001" });
  return value;
}

function requireOk<T>(result: { ok: true; value: T } | { ok: false; error: { id: string } }): T {
  if (!result.ok) throw new TRPCError({ code: "FORBIDDEN", message: result.error.id });
  return result.value;
}

export const formsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.actor);
    return listForms(ctx.db, SIG());
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.actor);
      return requireFound(await getForm(ctx.db, input.id, SIG()));
    }),

  submissions: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.actor);
      return requireOk(await listSubmissions(ctx.db, ctx.actor, input.formId, SIG()));
    }),

  // Everything the editor's pickers need, read in one round trip.
  options: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.actor);
    const signal = SIG();
    const [pipelineRows, stageRows, userRows, customFields] = await Promise.all([
      ctx.db
        .select({ id: pipelines.id, name: pipelines.name })
        .from(pipelines)
        .where(eq(pipelines.isArchived, false))
        .orderBy(asc(pipelines.order)),
      ctx.db
        .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
        .from(stages)
        .orderBy(asc(stages.order)),
      ctx.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.isActive, true))
        .orderBy(asc(users.name)),
      listEligibleCustomFields(ctx.db, signal),
    ]);
    return {
      pipelines: pipelineRows,
      stages: stageRows,
      users: userRows,
      customFields: customFields.map((def) => ({
        id: def.id,
        name: def.name,
        targetEntity: def.targetEntity,
        type: def.type,
      })),
    };
  }),
});
