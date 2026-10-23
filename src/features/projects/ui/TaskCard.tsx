"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { cn } from "@/lib/utils";
import type { TaskView } from "../types";
import { ProjectDueDate } from "./ProjectChrome";

const S = PROJECTS_API_STRINGS.projects.task;

export function TaskCard({
  task,
  canEdit,
  now,
  onOpen,
  onToggleDone,
  overlay = false,
}: {
  task: TaskView;
  canEdit: boolean;
  now: Date;
  onOpen: () => void;
  onToggleDone: (done: boolean) => void;
  overlay?: boolean;
}): React.ReactNode {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { phaseId: task.phaseId },
    disabled: !canEdit,
  });
  const style = transform === null ? undefined : { transform: CSS.Translate.toString(transform) };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      data-testid={overlay ? undefined : "task-card"}
      data-task-id={overlay ? undefined : task.id}
      className={cn(
        "rounded-md border border-border bg-card p-2.5 transition-[border-color,box-shadow] duration-100",
        // No touch-none: the board uses a delayed TouchSensor so a swipe still scrolls the page.
        canEdit && "cursor-grab focus-within:ring-1 focus-within:ring-ring",
        isDragging && "opacity-40",
        !overlay && "hover:border-border-strong hover:shadow-card-hover",
        overlay && "w-64 rotate-2 shadow-drag",
      )}
      // Listeners only: the dnd attributes add role=button around the checkbox and title button
      // (axe nested-interactive). Pointer dragging is unchanged.
      {...(canEdit ? listeners : {})}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={task.done}
          onCheckedChange={onToggleDone}
          label={task.done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
          disabled={!canEdit}
        />
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "min-w-0 flex-1 text-left text-sm font-medium text-foreground hover:underline",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-meta text-muted-foreground">
        {task.assigneeName !== null ? (
          <span className="flex min-w-0 items-center gap-1">
            <Avatar name={task.assigneeName} className="size-5 shrink-0 text-caption" />
            <span className="truncate">{task.assigneeName}</span>
          </span>
        ) : (
          <span>{S.unassigned}</span>
        )}
        {task.dueDate !== null && task.dueDate !== "" && (
          <ProjectDueDate
            value={task.dueDate}
            now={now}
            className="shrink-0 items-end text-right"
          />
        )}
      </div>
    </div>
  );
}
