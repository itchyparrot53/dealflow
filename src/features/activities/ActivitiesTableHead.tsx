"use client";
import type React from "react";
import type { ColumnDef } from "@/components/data-table/columnModel";
import type { ColumnSort } from "@/components/data-table/useColumnSort";
import { Checkbox } from "@/components/ui/Checkbox";
import { ActivitySortableTh } from "./ActivitySortableHeader";
import type { ActivitySortField } from "./schemas";

interface ActivitiesTableHeadProps {
  effective: ColumnSort<ActivitySortField>;
  onSort: (field: ActivitySortField) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  visibleColumns: ColumnDef[];
}

const SORTABLE: Partial<Record<string, ActivitySortField>> = {
  subject: "subject",
  priority: "priority",
  due: "dueAtIso",
  duration: "duration",
};

// The Activities table's <thead>, extracted from ActivitiesTable to keep it under the
// project's file-size budget. Column order and labels are Pipedrive parity (Task 8's
// Duration/Assignee columns, Task 9's sortable Duration).
export function ActivitiesTableHead({
  effective,
  onSort,
  allSelected,
  onToggleAll,
  visibleColumns,
}: ActivitiesTableHeadProps): React.ReactNode {
  return (
    <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
      <tr>
        <th className="w-8 px-3 py-2">
          <Checkbox
            label="Select all activities"
            checked={allSelected}
            onCheckedChange={onToggleAll}
          />
        </th>
        <th className="px-3 py-2 font-semibold">Done</th>
        {visibleColumns.map((column) => {
          const field = SORTABLE[column.key];
          return field === undefined ? (
            <th key={column.key} className="px-3 py-2 font-semibold">
              {column.header}
            </th>
          ) : (
            <ActivitySortableTh
              key={column.key}
              field={field}
              label={column.header}
              sort={effective}
              onSort={onSort}
            />
          );
        })}
      </tr>
    </thead>
  );
}
