"use client";
import Link from "next/link";
import type React from "react";
import { cn } from "@/lib/utils";
import { Tip } from "./tooltip";

export interface ViewSwitcherOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  // A navigation view renders a link; the board's in-place views render a button.
  href?: string;
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
        const className = cn(
          "inline-flex h-8 w-12 items-center justify-center border-l border-border-strong text-foreground transition-colors duration-100 first:border-l-0 [&_svg]:size-4",
          index === 0 && "rounded-l-md",
          index === options.length - 1 && "rounded-r-md",
          selected && "bg-info-soft text-info ring-1 ring-info ring-inset",
        );
        return (
          <Tip key={option.value} label={option.label}>
            {option.href === undefined ? (
              <button
                type="button"
                aria-label={option.label}
                aria-pressed={selected}
                data-testid={`view-${option.value}`}
                onClick={() => onChange(option.value)}
                className={className}
              >
                {option.icon}
              </button>
            ) : (
              <Link
                href={option.href}
                aria-label={option.label}
                aria-current={selected ? "page" : undefined}
                data-testid={`view-${option.value}`}
                className={className}
              >
                {option.icon}
              </Link>
            )}
          </Tip>
        );
      })}
    </fieldset>
  );
}
