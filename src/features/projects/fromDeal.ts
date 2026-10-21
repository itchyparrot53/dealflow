import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { loadEditableDeal } from "@/features/deals/dealAuth";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, type Result } from "@/types/result";
import { createProject } from "./projects";
import type { ProjectView } from "./types";

// "Create project" from a won deal (6.6). The deal must be visible and editable by the actor:
// loadEditableDeal enforces both, so an invisible deal is a not-found and a visible-but-unowned one
// is a permission error. The project is named after the deal and links the deal, person and
// organization, with the deal owner as the project owner.

// The user-facing server action must not accept the automation-only escape hatch.
export function sanitizeUserProjectInput(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const copy: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  delete copy.allowAnyStatus;
  return copy;
}

export const createProjectFromDealInput = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phases: z.array(z.string().trim().min(1).max(80)).min(1).max(10).optional(),
  // Automations may start a project on any deal in their trigger; the user path is won-only.
  allowAnyStatus: z.boolean().optional(),
});

export async function createProjectFromDeal(
  db: Db,
  actor: PermSetUser,
  dealId: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<ProjectView, AppError>> {
  const parsed = createProjectFromDealInput.safeParse(raw ?? {});
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.PROJECT_INPUT_INVALID, "invalid create-project input", {
        issues: parsed.error.issues,
      }),
    );
  }
  const deal = await loadEditableDeal(db, actor, dealId, signal);
  if (!deal.ok) return deal;

  if (parsed.data.allowAnyStatus !== true && deal.value.deal.status !== "won") {
    return err(
      new AppError(ERROR_IDS.PROJECT_INPUT_INVALID, "only a won deal can start a project", {
        dealId,
        reason: "deal_not_won",
        status: deal.value.deal.status,
      }),
    );
  }

  return createProject(
    db,
    actor,
    {
      name: parsed.data.name ?? deal.value.deal.title,
      dealId,
      personId: deal.value.deal.personId,
      organizationId: deal.value.deal.orgId,
      ownerId: deal.value.deal.ownerId,
      phases: parsed.data.phases,
    },
    signal,
  );
}
