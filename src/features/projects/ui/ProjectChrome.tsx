import type React from "react";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { formatCalendarDate, formatDueLabel } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "../types";

const S = PROJECTS_API_STRINGS.projects;

// Status is a quiet dot plus a label (2026 SaaS convention): no filled pill shouting for
// attention on every row. Colour is supplementary; the label always carries the meaning.
const STATUS_DOT: Record<ProjectStatus, string> = {
  active: "bg-info",
  on_hold: "bg-warning",
  completed: "bg-success",
  cancelled: "bg-muted-foreground",
};

export function ProjectStatusLabel({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}): React.ReactNode {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-meta font-medium",
        status === "cancelled" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {S.statuses[status]}
    </span>
  );
}

// One shared progress presentation for the list and the project header. A task-less project says
// so instead of rendering an empty track that reads as a bug.
export function ProjectProgress({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}): React.ReactNode {
  if (total === 0) {
    return <span className={cn("text-meta text-muted-foreground", className)}>No tasks</span>;
  }
  const percent = Math.round((done / total) * 100);
  return (
    <span
      data-testid="project-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} of ${total} tasks done`}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span aria-hidden="true" className="h-1 w-16 overflow-hidden rounded-full bg-track">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </span>
      <span className="whitespace-nowrap text-meta text-muted-foreground tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

// "Nov 22" plus the urgency in words. The words do the work; only overdue turns destructive.
export function ProjectDueDate({
  value,
  now,
  className,
}: {
  value: string | null;
  now: Date;
  className?: string;
}): React.ReactNode {
  if (value === null || value === "") {
    return <span className={cn("text-meta text-muted-foreground", className)}>No due date</span>;
  }
  const label = formatDueLabel(value, now);
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      <span className="text-meta text-foreground tabular-nums">
        {formatCalendarDate(value, now)}
      </span>
      {label !== null && (
        <span
          className={cn(
            "text-meta",
            label.tone === "overdue"
              ? "font-medium text-destructive"
              : label.tone === "today"
                ? "font-medium text-foreground"
                : "text-muted-foreground",
          )}
        >
          {label.text}
        </span>
      )}
    </span>
  );
}
