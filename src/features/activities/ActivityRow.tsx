"use client";
import Link from "next/link";
import type React from "react";
import { Fragment, useEffect, useRef } from "react";
import type { ColumnDef } from "@/components/data-table/columnModel";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyCell } from "@/components/ui/table-parts";
import { ACTIVITY_PRIORITIES, isActivityPriorityKey } from "@/constants/activityPriorities";
import { RecurrenceBadge } from "@/features/activities/recurrence/ui/RecurrenceBadge";
import { OwnerBadge } from "@/features/identity/OwnerBadge";
import { cn } from "@/lib/utils";
import { ActivityTypeIcon } from "./ActivityTypeIcon";
import type { ActivityTableRow } from "./activityRows";
import { fmtDue } from "./dueLabel";
import { isActivityOverdue } from "./overdue";

// Wrapped at module scope so the clock read stays out of the render body (React Compiler
// flags Date.now() called during render). An all-day row is late only once its DAY has passed.
function isOverdue(row: ActivityTableRow): boolean {
  return isActivityOverdue(
    row.dueAtIso === null ? null : new Date(row.dueAtIso),
    row.allDay,
    row.done,
    Date.now(),
  );
}

// Extracted from ActivitiesTable to keep both files under the project's file-size budget
// (mirrors PeopleTable/PeopleList): a single Pipedrive-style row, with a selection checkbox
// (bulk actions) kept independent of the Done checkbox (per-row complete/reopen).
export interface ActivityRowProps {
  row: ActivityTableRow;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleDone: (id: string, currentDone: boolean) => void;
  onRowClick: (row: ActivityTableRow) => void;
  // True for the single row under the j/k keyboard cursor.
  cursor: boolean;
  // Ordered, visible columns from the picker; the select/done cells are always rendered first.
  visibleColumns: ColumnDef[];
}

function fmtDuration(minutes: number | null): string {
  return minutes === null ? "" : `${minutes} min`;
}

// One optional cell per catalog key. The fixed select/done cells stay outside this map; every other
// column can be hidden or reordered from the column picker.
function cellFor(key: string, row: ActivityTableRow): React.ReactNode {
  return contactCellFor(key, row) ?? scheduleCellFor(key, row);
}

function textOrDash(value: string | null): React.ReactNode {
  return value ?? <EmptyCell />;
}

function entityLink(href: string | null, label: string | null): React.ReactNode {
  if (href !== null && label !== null) {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className="text-link-record hover:underline"
      >
        {label}
      </Link>
    );
  }
  return textOrDash(label);
}

function anchorLink(href: string | null, label: string | null): React.ReactNode {
  if (href !== null && label !== null) {
    return (
      <a
        href={href}
        onClick={(e) => e.stopPropagation()}
        className="text-link-record hover:underline"
      >
        {label}
      </a>
    );
  }
  return textOrDash(label);
}

function contactCellFor(key: string, row: ActivityTableRow): React.ReactNode {
  switch (key) {
    case "subject":
      return (
        <td className="h-[33px] whitespace-nowrap px-3">
          <span className="flex items-center gap-2">
            <ActivityTypeIcon typeKey={row.typeKey} />
            <span
              className={cn(
                "max-w-[28rem] truncate font-medium",
                row.done && "text-muted-foreground line-through",
              )}
            >
              {row.subject}
            </span>
            <RecurrenceBadge rule={row.recurrenceRule} ended={row.recurrenceEnded} />
          </span>
        </td>
      );
    case "deal":
      return (
        <td className="h-[33px] whitespace-nowrap px-3 text-muted-foreground">
          {row.dealId === null ? "-" : entityLink(`/deals/${row.dealId}`, row.dealTitle ?? "Deal")}
        </td>
      );
    case "priority":
      return (
        <td className="h-[33px] whitespace-nowrap px-3">
          {row.priority !== null && isActivityPriorityKey(row.priority) ? (
            <span style={{ color: ACTIVITY_PRIORITIES[row.priority].color }}>
              {ACTIVITY_PRIORITIES[row.priority].name}
            </span>
          ) : (
            "-"
          )}
        </td>
      );
    case "contact":
      return (
        <td className="h-[33px] whitespace-nowrap px-3">
          {entityLink(
            row.personId === null ? null : `/contacts/people/${row.personId}`,
            row.personName,
          )}
        </td>
      );
    case "email":
      return (
        <td className="h-[33px] whitespace-nowrap px-3 text-muted-foreground">
          {anchorLink(
            row.personEmail === null ? null : `mailto:${row.personEmail}`,
            row.personEmail,
          )}
        </td>
      );
    case "phone":
      return (
        <td className="h-[33px] whitespace-nowrap px-3 text-muted-foreground">
          {anchorLink(row.personPhone === null ? null : `tel:${row.personPhone}`, row.personPhone)}
        </td>
      );
    case "organization":
      return (
        <td className="h-[33px] whitespace-nowrap px-3 text-muted-foreground">
          {entityLink(row.orgId === null ? null : `/contacts/orgs/${row.orgId}`, row.orgName)}
        </td>
      );
    default:
      return null;
  }
}

function scheduleCellFor(key: string, row: ActivityTableRow): React.ReactNode {
  switch (key) {
    case "due":
      return (
        <td className="h-[33px] whitespace-nowrap px-3 text-muted-foreground tabular-nums">
          {fmtDue(row.dueAtIso, row.allDay)}
        </td>
      );
    case "duration":
      return (
        <td className="h-[33px] whitespace-nowrap px-3 text-muted-foreground tabular-nums">
          {fmtDuration(row.durationMinutes)}
        </td>
      );
    case "assignee":
      return (
        <td className="h-[33px] whitespace-nowrap px-3">
          <OwnerBadge name={row.assigneeName} />
        </td>
      );
    default:
      return null;
  }
}

export function ActivityRow({
  row,
  selected,
  onToggleSelect,
  onToggleDone,
  onRowClick,
  cursor,
  visibleColumns,
}: ActivityRowProps): React.ReactNode {
  const ref = useRef<HTMLTableRowElement>(null);

  // Keep the cursor row in view when j/k walks past the edge of the scroll container.
  useEffect(() => {
    if (cursor) ref.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <tr
      ref={ref}
      onClick={() => onRowClick(row)}
      data-cursor={cursor ? "true" : undefined}
      data-testid="table-row"
      className={cn(
        "h-[33px] cursor-pointer border-b border-grid transition-colors duration-100 hover:bg-muted",
        isOverdue(row) && "text-next-red",
        cursor && "bg-info-soft",
      )}
    >
      <td className="h-[33px] whitespace-nowrap px-3">
        {/* Row is clickable (opens the editor); the span stops the checkbox click from
            bubbling to the row so selecting does not also open the modal. The Checkbox owns
            its own interaction, so the wrapper is a pure pointer-propagation guard. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation guard only */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: propagation guard only */}
        <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            label={`Select ${row.subject}`}
            checked={selected}
            onCheckedChange={() => onToggleSelect(row.id)}
          />
        </span>
      </td>
      <td className="h-[33px] whitespace-nowrap px-3">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation guard only */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: propagation guard only */}
        <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            label={`Complete ${row.subject}`}
            checked={row.done}
            onCheckedChange={() => onToggleDone(row.id, row.done)}
            // Round and green, matching the deal workspace's activity card, so Done never
            // reads as a second copy of the square selection box sitting next to it.
            className="rounded-full data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
          />
        </span>
      </td>
      {visibleColumns.map((column) => (
        <Fragment key={column.key}>{cellFor(column.key, row)}</Fragment>
      ))}
    </tr>
  );
}
