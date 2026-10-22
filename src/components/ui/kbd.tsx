import type React from "react";
import { cn } from "@/lib/utils";

// A keyboard hint for a shortcut. 20 high, 0 6 padding, radius 4, muted fill, 12 px secondary.
export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 items-center rounded-md bg-muted px-1.5 font-sans text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
