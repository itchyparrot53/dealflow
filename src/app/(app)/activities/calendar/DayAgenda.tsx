"use client";
import Link from "next/link";
import type React from "react";
import type { CalendarActivity } from "@/features/activities/calendar";
import { cn } from "@/lib/utils";

function timeLabel(activity: CalendarActivity): string {
  if (activity.allDay) return "All day";
  return activity.dueAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function onDay(activity: CalendarActivity, dayIso: string): boolean {
  const start = activity.dueAt.toISOString().slice(0, 10);
  if (start === dayIso) return true;
  if (activity.endAt === null || activity.endAt === undefined) return false;
  const end = activity.endAt.toISOString().slice(0, 10);
  return start <= dayIso && dayIso <= end;
}

// The mobile agenda (6.9): a plain day list instead of the hour grid, which needs far more width
// than a phone has. The week grid stays the desktop default; below md the week view is rendered
// as this list for the anchor day.
export function DayAgenda({
  dayIso,
  activities,
}: {
  dayIso: string;
  activities: CalendarActivity[];
}): React.ReactNode {
  const items = activities
    .filter((activity) => onDay(activity, dayIso))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing scheduled for this day.
      </p>
    );
  }

  return (
    <ul data-testid="day-agenda" className="flex flex-col gap-2">
      {items.map((activity) => (
        <li key={activity.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
          <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
            {timeLabel(activity)}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-medium",
                activity.done && "text-muted-foreground line-through",
              )}
            >
              {activity.subject}
            </p>
            {activity.dealId !== null &&
            activity.dealTitle !== null &&
            activity.dealTitle !== undefined ? (
              <Link
                href={`/deals/${activity.dealId}`}
                className="mt-0.5 block truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {activity.dealTitle}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
