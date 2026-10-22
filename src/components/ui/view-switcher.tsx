"use client";
import type React from "react";
import { cn } from "@/lib/utils";
import { Tip } from "./tooltip";

export interface ViewSwitcherOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

// Pipedrive's segmented view switcher: 48x32 segments, joined rounded-md ends, a 1 px strong
// border, and the selected segment filled with the blue info tint and border.
export function ViewSwitcher({
  options,
  value,
  onChange,
  label = "View",
  className,
}: {
  options: ReadonlyArray<ViewSwitcherOption>;
  value: string;
  onChange: (next: string) => void;
  label?: string;
  className?: string;
}): React.ReactNode {
  return (
    <fieldset
      aria-label={label}
      data-testid="view-switcher"
      className={cn(
        "m-0 inline-flex min-w-0 overflow-hidden rounded-md border border-border-strong p-0",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Tip key={option.value} label={option.label}>
            <button
              type="button"
              aria-label={option.label}
              aria-pressed={selected}
              data-testid={`view-${option.value}`}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex h-8 w-12 items-center justify-center border-l border-border-strong text-foreground transition-colors duration-100 first:border-l-0 [&_svg]:size-4",
                index === 0 && "rounded-l-md",
                index === options.length - 1 && "rounded-r-md",
                selected && "bg-info-soft text-info ring-1 ring-info ring-inset",
              )}
            >
              {option.icon}
            </button>
          </Tip>
        );
      })}
    </fieldset>
  );
}
