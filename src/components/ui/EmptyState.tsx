import type React from "react";
import { cn } from "@/lib/utils";

// One empty state for the whole app, composed like the app's not-found page: centred, quiet,
// one sentence that says what this surface holds, and the action it just described.
// `action` is optional because some surfaces (a quota the viewer cannot set) have no honest one.
export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-4 p-12 text-center", className)}
    >
      {icon !== undefined ? (
        <div className="text-muted-foreground [&>svg]:size-16">{icon}</div>
      ) : null}
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-[48ch] text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
