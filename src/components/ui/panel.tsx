import type React from "react";
import { cn } from "@/lib/utils";

// The settings and dashboard section surface: a card with a 48 px header (16/600 title, actions
// right) and a 16 px body. Static, so no shadow.
export function Panel({
  title,
  actions,
  children,
  padded = true,
  tone = "card",
  className,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  tone?: "card" | "subtle";
  className?: string;
}): React.ReactNode {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border",
        tone === "subtle" ? "bg-canvas-subtle" : "bg-card",
        className,
      )}
    >
      {title === undefined ? null : (
        <header className="flex h-12 items-center justify-between gap-3 border-b px-4">
          {typeof title === "string" ? (
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          ) : (
            title
          )}
          {actions === undefined ? null : <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}
