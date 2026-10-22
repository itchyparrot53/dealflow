import type React from "react";
import { cn } from "@/lib/utils";

// shadcn (new-york) Skeleton wrapper: a pulsing placeholder block used by route loading.tsx
// fallbacks so a navigation paints an instant shell while the server renders. Presentational
// only (no Radix primitive applies). Uses the muted token and rounded-md (--radius) so its
// corners match the real cards/inputs it stands in for.
export function Skeleton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">): React.ReactNode {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)} {...props}>
      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent motion-reduce:hidden"
      />
    </div>
  );
}
