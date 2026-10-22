"use client";
import { ArrowUp } from "lucide-react";
import type React from "react";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Tip } from "@/components/ui/tooltip";
import { STRINGS } from "@/constants/strings";
import { cn } from "@/lib/utils";
import { BOARD_SORT_KEYS, type BoardSortKey, type SortDirection } from "./boardSort";

const SORT = STRINGS.board.sort;

export interface BoardSortControlProps<K extends string = BoardSortKey> {
  sortKey: K;
  direction: SortDirection;
  onKeyChange: (key: K) => void;
  onToggleDirection: () => void;
  extraOptions?: readonly { key: K; label: string }[];
}

// The "Sort by" cluster Pipedrive puts above the board: a field dropdown plus an asc/desc
// arrow toggle. The chosen sort applies within each column (BoardColumn stays position-agnostic).
export function BoardSortControl<K extends string = BoardSortKey>(
  props: BoardSortControlProps<K>,
): React.ReactNode {
  const { sortKey, direction, onKeyChange, onToggleDirection, extraOptions = [] } = props;
  // The arrow points the way the data currently reads; the button offers the opposite action.
  const toggleLabel = direction === "asc" ? SORT.descending : SORT.ascending;
  const options: SelectOption[] = [
    ...BOARD_SORT_KEYS.map<SelectOption>((key) => ({ value: key, label: SORT.options[key] })),
    ...extraOptions.map<SelectOption>((o) => ({ value: o.key, label: o.label })),
  ];

  return (
    <div className="inline-flex items-center gap-2">
      {/* Label kept on one line: at the far right of the filter row a wrapping "Sort / by" reads
          as broken. */}
      <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-info">
        {SORT.label}:
      </span>
      {/* Field + direction share one bordered pill (like the "+ Deal" split button) so the sort
          reads as a single control rather than three loose pieces. */}
      <div className="inline-flex items-center">
        <Select
          ariaLabel={SORT.label}
          value={sortKey}
          onChange={(v) => onKeyChange(v as K)}
          options={options}
          triggerClassName="h-8 w-auto rounded-md border-0 bg-info-soft px-2 font-semibold text-info hover:bg-info-soft"
        />
        <Tip label={toggleLabel}>
          <button
            type="button"
            aria-label={toggleLabel}
            onClick={onToggleDirection}
            className="flex size-8 items-center justify-center rounded-md bg-info-soft text-info transition-colors duration-100 hover:bg-info-soft-strong"
          >
            {/* Up arrow = ascending; rotated 180deg for descending. */}
            <ArrowUp
              aria-hidden="true"
              className={cn("size-4 transition-transform", direction === "desc" && "rotate-180")}
            />
          </button>
        </Tip>
      </div>
    </div>
  );
}
