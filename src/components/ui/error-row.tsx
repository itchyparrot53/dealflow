import type React from "react";
import { cn } from "@/lib/utils";

// 6.8.13: an inline failure reads as one row, not a paragraph: a 3 px destructive left bar on the
// soft red fill, 14 px text, and an optional recovery action at the right.
export function ErrorRow({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-md border-l-[3px] border-l-destructive bg-destructive/10 px-3 py-2 text-sm text-foreground",
        className,
      )}
    >
      <span className="min-w-0">{children}</span>
      {action === undefined ? null : <span className="shrink-0">{action}</span>}
    </div>
  );
}
