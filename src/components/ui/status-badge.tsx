import type React from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeTone = "overdue" | "plan" | "new" | "neutral";

// The one all-caps surface in the app (PLAN-PART11.md 6.1 row 15): 20 high, 0 6 padding,
// 12/16/700. Overdue and new are pills; a plan tag is a 1 px outlined rectangle.
const TONES: Record<StatusBadgeTone, string> = {
  overdue: "rounded-full bg-destructive text-destructive-foreground",
  new: "rounded-full bg-badge-new text-white",
  plan: "rounded-md border border-badge-plan-border bg-badge-plan-bg text-badge-plan-fg",
  neutral: "rounded-md bg-muted text-muted-foreground",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusBadgeTone;
  children: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center justify-center px-1.5 text-xs font-bold uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
