"use client";

import { moveDealAction } from "@/features/deals/moveAction";
import { restoreItemAction } from "@/features/recycle/actions";
import { err, ok, type Result } from "@/types/result";
import { readCsrfToken } from "@/utils/csrfCookie";
import { useToastStore } from "./toastStore";

// Undo helpers for the toast region (6.8). Both reverse through the existing services: a stage
// move goes back through moveDealAction with the updatedAt the forward move returned (so a second
// edit in between is refused by the compare-and-swap), and a delete goes through restoreItem.

export type DeletableEntity = "deal" | "person" | "organization" | "activity";

function undoFailed(message: string): Result<unknown, unknown> {
  useToastStore.getState().push({ message, tone: "error" });
  return err({ id: "E_UNDO_FAILED", message });
}

export function pushStageUndo(input: {
  dealId: string;
  fromStageId: string;
  toStageName: string;
  updatedAt: string;
  onUndone: () => void;
}): string {
  return useToastStore.getState().push({
    message: `Moved to ${input.toStageName}`,
    action: {
      label: "Undo",
      run: async () => {
        const result = await moveDealAction(
          {
            dealId: input.dealId,
            toStageId: input.fromStageId,
            beforePosition: null,
            afterPosition: null,
            expectedUpdatedAt: input.updatedAt,
          },
          readCsrfToken(),
        );
        if (!result.ok) return undoFailed("Couldn't undo: the deal changed since");
        input.onUndone();
        return ok(undefined);
      },
    },
  });
}

export function pushDeleteUndo(input: {
  entity: DeletableEntity;
  ids: readonly string[];
  noun: string;
  onRestored: () => void;
}): string {
  const count = input.ids.length;
  return useToastStore.getState().push({
    message: `${String(count)} ${input.noun}${count === 1 ? "" : "s"} deleted`,
    action: {
      label: "Undo",
      run: async () => {
        let failed = 0;
        for (const id of input.ids) {
          const result = await restoreItemAction({ entity: input.entity, id }, readCsrfToken());
          if (!result.ok) failed += 1;
        }
        if (failed > 0) {
          return undoFailed(
            failed === count
              ? "Couldn't restore the deleted record"
              : "Some records could not be restored",
          );
        }
        input.onRestored();
        return ok(undefined);
      },
    },
  });
}
