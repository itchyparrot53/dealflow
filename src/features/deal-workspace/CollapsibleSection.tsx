"use client";
import { ChevronDown, Filter } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { HideEmptyContext } from "./sidebar/sectionFilter";

// A titled, collapsible sidebar section (Pipedrive's deal detail groups Summary/Details/Source/
// etc. as collapsible cards). Defaults open; the header toggles visibility. The funnel button
// hides value-less FieldRows via HideEmptyContext (pixel-parity fix 2).
export function CollapsibleSection({
  title,
  defaultOpen = true,
  headerActions,
  showFilter = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  headerActions?: (ctx: { hideEmpty: boolean; showEmptyFields: () => void }) => React.ReactNode;
  // PD's Summary header carries only the kebab (no hide-empty funnel: its action-list rows are
  // never empty), so that section opts out of the filter toggle.
  showFilter?: boolean;
  children: React.ReactNode;
}): React.ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  const [hideEmpty, setHideEmpty] = useState(false);
  return (
    <section aria-label={title} className="border-b border-border bg-card">
      <div data-testid="sidebar-row" className="flex h-16 items-center gap-1 pr-3 pl-6">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-full flex-1 items-center gap-2 text-base font-semibold text-foreground transition-colors duration-100 hover:bg-muted"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none",
              open ? "" : "-rotate-90",
            )}
          />
          {title}
        </button>
        {showFilter && (
          <button
            type="button"
            aria-label="Hide empty fields"
            aria-pressed={hideEmpty}
            onClick={() => setHideEmpty((v) => !v)}
            className={
              hideEmpty
                ? "rounded p-1 text-primary hover:bg-accent"
                : "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            }
          >
            <Filter aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        {headerActions?.({ hideEmpty, showEmptyFields: () => setHideEmpty(false) })}
      </div>
      <div
        aria-hidden={!open}
        // Keep content mounted so the Tailwind grid transition can reverse smoothly. `inert`
        // removes closed controls from focus/navigation while preserving their layout subtree.
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-opacity",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-6 pb-4 pl-14">
            <HideEmptyContext.Provider value={hideEmpty}>{children}</HideEmptyContext.Provider>
          </div>
        </div>
      </div>
    </section>
  );
}
