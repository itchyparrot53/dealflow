import type React from "react";
import { cn } from "@/lib/utils";

// The 64 px row under the top bar: view switcher at left, the primary split button 8 px after it,
// and the count / pipeline / filter controls right-aligned. Below 768 it wraps to two rows.
export function PageToolbar({
  left,
  primary,
  right,
  className,
}: {
  left?: React.ReactNode;
  primary?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <div
      data-testid="page-toolbar"
      className={cn("flex min-h-16 flex-wrap items-center gap-3 py-4 md:flex-nowrap", className)}
    >
      {left === undefined ? null : <div className="flex items-center gap-2">{left}</div>}
      {primary === undefined ? null : <div className="flex items-center gap-2">{primary}</div>}
      {right === undefined ? null : <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
