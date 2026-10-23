"use client";

import type React from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { formatCalendarDate } from "@/lib/format/date";

const S = PROJECTS_API_STRINGS.projects;
const NOT_SET_PLACEHOLDER = "Not set";

// Start and due date controls. Read-only viewers get the formatted dates, not live pickers that
// would fail on save.
export function ProjectDates({
  startDate,
  dueDate,
  canEdit,
  now,
  onChange,
}: {
  startDate: string | null;
  dueDate: string | null;
  canEdit: boolean;
  now: Date;
  onChange: (field: "startDate" | "dueDate", value: string | null) => void;
}): React.ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-4 text-meta text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {S.startDate}
        {canEdit ? (
          <DatePicker
            value={startDate}
            onChange={(value) => onChange("startDate", value)}
            ariaLabel={S.startDate}
            placeholder={NOT_SET_PLACEHOLDER}
          />
        ) : (
          <span className="text-foreground">
            {startDate === null ? NOT_SET_PLACEHOLDER : formatCalendarDate(startDate, now)}
          </span>
        )}
      </span>
      <span className="flex items-center gap-1.5">
        {S.dueDate}
        {canEdit ? (
          <DatePicker
            value={dueDate}
            onChange={(value) => onChange("dueDate", value)}
            ariaLabel={S.dueDate}
            placeholder={NOT_SET_PLACEHOLDER}
          />
        ) : (
          <span className="text-foreground">
            {dueDate === null ? NOT_SET_PLACEHOLDER : formatCalendarDate(dueDate, now)}
          </span>
        )}
      </span>
    </div>
  );
}
