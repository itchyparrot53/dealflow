"use client";

import { useDroppable } from "@dnd-kit/core";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { cn } from "@/lib/utils";
import type { PhaseView, TaskView } from "../types";
import { TaskCard } from "./TaskCard";

const S = PROJECTS_API_STRINGS.projects.task;

export function PhaseColumn({
  phase,
  tasks,
  canEdit,
  onAddTask,
  onOpenTask,
  onToggleDone,
}: {
  phase: PhaseView | null;
  tasks: TaskView[];
  canEdit: boolean;
  onAddTask: () => void;
  onOpenTask: (task: TaskView) => void;
  onToggleDone: (task: TaskView, done: boolean) => void;
}): React.ReactNode {
  const phaseKey = phase?.id ?? "none";
  const { setNodeRef, isOver } = useDroppable({
    id: `phase:${phaseKey}`,
    data: { phaseId: phase?.id ?? null },
  });
  const ordered = [...tasks].sort((a, b) => a.position - b.position);

  return (
    <section
      ref={setNodeRef}
      data-testid="phase-column"
      data-phase-id={phase?.id ?? "none"}
      aria-label={phase?.name ?? S.noPhase}
      className={cn(
        "flex min-h-48 w-[248px] shrink-0 flex-col gap-2 rounded-lg bg-canvas-subtle p-2",
        isOver && "ring-2 ring-ring",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 className="truncate text-base font-semibold text-foreground">
          {phase?.name ?? S.noPhase}
        </h2>
        <span className="text-meta text-muted-foreground">{ordered.length}</span>
      </header>
      <div className="flex flex-col gap-1">
        {ordered.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canEdit={canEdit}
            onOpen={() => onOpenTask(task)}
            onToggleDone={(done) => onToggleDone(task, done)}
          />
        ))}
      </div>
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="task-add"
          onClick={onAddTask}
          className="justify-start"
        >
          + {S.add}
        </Button>
      )}
    </section>
  );
}
