"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { cn } from "@/lib/utils";
import type { TaskView } from "../types";

const S = PROJECTS_API_STRINGS.projects.task;

export function TaskCard({
  task,
  canEdit,
  onOpen,
  onToggleDone,
  overlay = false,
}: {
  task: TaskView;
  canEdit: boolean;
  onOpen: () => void;
  onToggleDone: (done: boolean) => void;
  overlay?: boolean;
}): React.ReactNode {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
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
        "rounded-md border bg-background p-2 shadow-sm",
        canEdit && "cursor-grab touch-none",
        isDragging && "opacity-40",
        overlay && "w-64 rotate-2 shadow-lg",
      )}
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={task.done}
          onCheckedChange={onToggleDone}
          label={task.done ? S.reopen : S.markDone}
          disabled={!canEdit}
        />
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "min-w-0 flex-1 text-left text-sm hover:underline",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {task.assigneeName !== null ? (
          <span className="flex items-center gap-1">
            <Avatar name={task.assigneeName} className="h-5 w-5 text-[10px]" />
            <span className="truncate">{task.assigneeName}</span>
          </span>
        ) : (
          <span>{S.unassigned}</span>
        )}
        {task.dueDate !== null && <span>{task.dueDate}</span>}
      </div>
    </div>
  );
}
