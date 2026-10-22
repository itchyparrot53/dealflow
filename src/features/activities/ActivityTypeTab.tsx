"use client";
import type React from "react";
import { cn } from "@/lib/utils";
import { ActivityTypeIcon } from "./ActivityTypeIcon";

// Extracted from ActivitiesTable to keep it under the project's file-size budget.
export function ActivityTypeTab({
  active,
  value,
  label,
  icon,
  onSelect,
}: {
  active: string | null;
  value: string | null;
  label: string;
  icon?: boolean;
  onSelect: (v: string | null) => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active === value}
      onClick={() => onSelect(value)}
      className={cn(
        // 6.6 chips: 24 high, 0 8 padding, info-soft fill, blue 14/500. "All" is 600.
        "flex h-6 items-center gap-1.5 rounded-md px-2 text-sm",
        active === value
          ? "bg-info-soft text-info"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        value === null && "font-semibold",
      )}
    >
      {icon === true && value !== null && <ActivityTypeIcon typeKey={value} />}
      {label}
    </button>
  );
}
