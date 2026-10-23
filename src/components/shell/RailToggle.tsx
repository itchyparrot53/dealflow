"use client";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import type React from "react";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RailState } from "./railState";

// The last rail row (PLAN-PART12.md 6.4). Expanded it names the action; collapsed it is an icon
// with a tooltip, so the control exists in both states at the same size.
export function RailToggle({
  state,
  onToggle,
}: {
  state: RailState;
  onToggle: () => void;
}): React.ReactNode {
  const collapsed = state === "collapsed";
  const button = (
    <button
      type="button"
      data-testid="rail-toggle"
      aria-expanded={!collapsed}
      aria-controls="app-nav"
      aria-label={collapsed ? "Expand sidebar" : undefined}
      onClick={onToggle}
      className={cn(
        "flex h-10 items-center rounded-lg text-rail-foreground/80 transition-colors duration-100 hover:bg-rail-hover hover:text-rail-foreground",
        collapsed ? "w-11 justify-center" : "w-full gap-3 px-3",
      )}
    >
      {collapsed ? (
        <ChevronsRight className="size-5" aria-hidden="true" />
      ) : (
        <ChevronsLeft className="size-5" aria-hidden="true" />
      )}
      {collapsed ? null : <span className="text-sm font-medium">Collapse</span>}
    </button>
  );
  return collapsed ? <Tip label="Expand sidebar">{button}</Tip> : button;
}
