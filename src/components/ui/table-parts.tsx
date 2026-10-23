import type React from "react";
import { cn } from "@/lib/utils";
import { tableStyles } from "./table-styles";

// 6.8: every empty cell reads the same way, with an accessible "Empty" for screen readers rather
// than a silent blank or a bare dash.
export function EmptyCell(): React.ReactNode {
  return (
    <span className={tableStyles.emptyCell}>
      <span aria-hidden="true">-</span>
      <span className="sr-only">Empty</span>
    </span>
  );
}

// 6.8: the "Showing n of total" text belongs in a footer row under the table, with the paging or
// load-more control on the right.
export function TableFooter({
  count,
  children,
  className,
}: {
  count: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <div className={cn(tableStyles.footer, className)}>
      <span className="text-meta text-muted-foreground">{count}</span>
      {children}
    </div>
  );
}
