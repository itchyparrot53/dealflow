"use client";
import { useState } from "react";
import type { RowSelection } from "@/components/data-table/useRowSelection";
import { PRODUCTIVITY_STRINGS } from "@/constants/productivityStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { type BulkActivityResult, bulkActivityAction } from "./list/bulkActions";
import { useInvalidateActivityLists } from "./useInvalidateActivityLists";

export interface ActivityBulkActions {
  error: string | null;
  bulkMarkDone: () => Promise<void>;
  bulkReschedule: (date: string) => Promise<void>;
  bulkChangeOwner: (ownerId: string) => Promise<void>;
  bulkDelete: () => Promise<void>;
}

// Bulk actions for the Activities table's selected rows (1.4). One server action loops the existing
// services and reports partial failure; only the ids that actually failed stay selected, so the
// user can see exactly what still needs attention.
export function useActivityBulkActions(selection: RowSelection): ActivityBulkActions {
  const [error, setError] = useState<string | null>(null);
  const invalidateActivityLists = useInvalidateActivityLists();

  async function run(input: {
    kind: "markDone" | "reschedule" | "owner" | "delete";
    date?: string;
    ownerId?: string;
  }): Promise<void> {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    const result: BulkActivityResult = await bulkActivityAction({ ...input, ids }, readCsrfToken());
    if (result.ok) {
      await invalidateActivityLists();
      selection.clear();
      setError(null);
      return;
    }
    const failedIds = result.error.failed.map((failure) => failure.id);
    // Only refetch when at least one write landed; a wholly failed batch changes nothing.
    if (failedIds.length < ids.length) await invalidateActivityLists();
    selection.clear();
    for (const id of failedIds) selection.toggle(id);
    setError(
      result.error.id === "E_BULK_002"
        ? PRODUCTIVITY_STRINGS.bulkPartial
        : result.error.id === "E_BULK_001"
          ? PRODUCTIVITY_STRINGS.bulkTooMany
          : PRODUCTIVITY_STRINGS.bulkPartial,
    );
  }

  return {
    error,
    bulkMarkDone: () => run({ kind: "markDone" }),
    bulkReschedule: (date: string) => run({ kind: "reschedule", date }),
    bulkChangeOwner: (ownerId: string) => run({ kind: "owner", ownerId }),
    bulkDelete: () => run({ kind: "delete" }),
  };
}
