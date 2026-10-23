"use client";
import { CalendarX } from "lucide-react";
import type React from "react";
import { CustomFieldCell } from "@/components/data-table/CustomFieldCell";
import { EmptyCell } from "@/components/ui/table-parts";
import { OwnerBadge } from "@/features/identity/OwnerBadge";
import type { ResolvedLabel } from "@/features/labels/resolveLabels";
import { useLabelChipResolver } from "@/features/labels/useLabelChipResolver";
import { formatCurrency } from "@/lib/formatCurrency";
import type { LeadRow } from "../leadRepo";
import type { LeadColumn } from "./columns";
import { nextActivityState } from "./nextActivityState";
import { isStaleWithoutActivity, type NoActivityAge } from "./noActivityAge";
import { sourceOriginLabel } from "./sourceOriginLabel";

function fmtDate(d: Date | string | null): string {
  if (d === null) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function NextActivity({
  at,
  now,
  age,
}: {
  at: Date | string | null;
  now: Date | null;
  age: NoActivityAge;
}): React.ReactNode {
  if (at === null) {
    // Calm by default. The warning tone only arrives once the lead has been quiet for two weeks,
    // and only after the clock is set so SSR and the first client render agree.
    const stale = now !== null && isStaleWithoutActivity(age, now);
    return (
      <span
        className={`inline-flex items-center gap-1 ${stale ? "text-warning-soft-foreground" : "text-muted-foreground"}`}
      >
        <CalendarX aria-hidden="true" className="h-3.5 w-3.5" />
        No activity
      </span>
    );
  }
  // Pre-mount `now` is null (server + first client render): render the date with no time-based
  // color so SSR and hydration agree. The overdue/today color appears once the clock is set.
  if (now === null) {
    return <span>{fmtDate(at)}</span>;
  }
  const state = nextActivityState(at, now);
  return <span className={state === "overdue" ? "text-destructive" : ""}>{fmtDate(at)}</span>;
}

function Labels({ chips }: { chips: ResolvedLabel[] }): React.ReactNode {
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip.name}
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${chip.classes}`}
        >
          {chip.name}
        </span>
      ))}
    </div>
  );
}

export function LeadCell({
  column,
  row,
  now,
  currency,
}: {
  column: LeadColumn;
  row: LeadRow;
  now: Date | null;
  currency: string;
}): React.ReactNode {
  const resolveLabels = useLabelChipResolver("lead");
  if (column.customField) {
    return (
      <CustomFieldCell
        def={column.customField}
        value={row.customFields[column.customField.key]}
        currency={currency}
      />
    );
  }
  switch (column.key) {
    case "title":
      return <span className="font-medium text-foreground">{row.title}</span>;
    case "nextActivity":
      return (
        <NextActivity
          at={row.nextActivityAt}
          now={now}
          age={{ createdAt: row.createdAt, lastActivityAt: row.lastActivityAt }}
        />
      );
    case "labels":
      return <Labels chips={resolveLabels(row.labels)} />;
    case "sourceOrigin":
      return <span className="text-muted-foreground">{sourceOriginLabel(row.sourceOrigin)}</span>;
    case "value":
      return (
        <span className="tabular-nums text-muted-foreground">
          {row.value !== null ? formatCurrency(row.value, currency) : <EmptyCell />}
        </span>
      );
    case "createdAt":
      return <span className="text-muted-foreground">{fmtDate(row.createdAt)}</span>;
    case "owner":
      return <OwnerBadge name={row.ownerName} />;
    default:
      return null;
  }
}
