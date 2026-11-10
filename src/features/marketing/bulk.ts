import { inArray } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  type ConsentBasis,
  MANUAL_SUBSCRIBE_BASES,
  type MarketingStatus,
} from "@/constants/marketing";
import type { Db } from "@/db/client";
import { personMarketing } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { applyMarketingTransition } from "./service";
import { isTransitionAllowed, requiresBasis } from "./status";

// 6.12: one marketing-status change across a selection. Capped at 5,000 per action, one consent
// event per person, and only marketing.manage may run it.

export const MARKETING_BULK_MAX = 5000;

export interface BulkStatusInput {
  personIds: string[];
  to: MarketingStatus;
  basis?: ConsentBasis | null;
}

export async function bulkChangeMarketingStatus(
  db: Db,
  actor: PermSetUser,
  input: BulkStatusInput,
  signal: AbortSignal,
): Promise<Result<{ applied: number }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "marketing.manage")) {
    return err(
      new AppError(ERROR_IDS.PERM_DENIED, "marketing.manage required", { userId: actor.id }),
    );
  }
  const ids = [...new Set(input.personIds)];
  if (ids.length === 0) return ok({ applied: 0 });
  if (ids.length > MARKETING_BULK_MAX) {
    return err(
      new AppError(ERROR_IDS.BULK_TOO_MANY, "selection exceeds the marketing bulk cap", {
        count: ids.length,
      }),
    );
  }
  if (requiresBasis("not_subscribed", input.to, "bulk")) {
    if (
      input.basis === undefined ||
      input.basis === null ||
      !(MANUAL_SUBSCRIBE_BASES as readonly ConsentBasis[]).includes(input.basis)
    ) {
      return err(
        new AppError(
          ERROR_IDS.MARKETING_INPUT_INVALID,
          "a direct subscribe needs a consent basis",
          {
            to: input.to,
          },
        ),
      );
    }
  }

  // Read the current statuses once, so the transaction only contains writes that the table allows.
  const rows = await db
    .select({ personId: personMarketing.personId, status: personMarketing.status })
    .from(personMarketing)
    .where(inArray(personMarketing.personId, ids));
  const byPerson = new Map(rows.map((row) => [row.personId, row.status]));
  const allowed = ids.filter((personId) =>
    isTransitionAllowed(byPerson.get(personId) ?? "not_subscribed", input.to, "bulk"),
  );
  if (allowed.length === 0) return ok({ applied: 0 });

  return db.transaction(async (tx) => {
    for (const personId of allowed) {
      const transition = await applyMarketingTransition(
        tx,
        {
          personId,
          to: input.to,
          source: "bulk",
          basis: input.basis ?? null,
          actorUserId: actor.id,
        },
        signal,
      );
      if (!transition.ok) throw transition.error;
    }
    return ok({ applied: allowed.length });
  });
}
