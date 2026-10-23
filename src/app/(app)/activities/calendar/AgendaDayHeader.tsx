import { isoToDayHeading } from "@/features/activities/dayHeading";
import { cn } from "@/lib/utils";

// One day's column header. Today is called out the way MonthView calls out its today cell, so a
// week opened on the current week says which column the viewer is standing in.
export function AgendaDayHeader({ iso, today }: { iso: string; today: boolean }): React.ReactNode {
  return (
    <div
      data-today={today}
      className={cn(
        "flex items-center gap-1 border-l border-border px-2 py-1 text-xs font-medium tabular-nums",
        today && "text-primary",
      )}
    >
      {/* 6.8.6: today's date number sits in an info-soft circle, in blue 600. */}
      <span
        className={cn(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1",
          today ? "bg-info-soft font-semibold text-info" : "text-foreground",
        )}
      >
        {isoToDayHeading(iso)}
      </span>
      {today && <span className="sr-only"> (today)</span>}
    </div>
  );
}
