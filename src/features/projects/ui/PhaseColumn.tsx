"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";
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
  now,
  onAddTask,
  onOpenTask,
  onToggleDone,
}: {
  phase: PhaseView | null;
  tasks: TaskView[];
  canEdit: boolean;
  now: Date;
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
  const active = ordered.filter((task) => !task.done);
  const done = ordered.filter((task) => task.done);
  const [showDone, setShowDone] = useState(false);
  const percent = ordered.length === 0 ? 0 : Math.round((done.length / ordered.length) * 100);

  return (
    <section
      ref={setNodeRef}
      data-testid="phase-column"
      data-phase-id={phase?.id ?? "none"}
      aria-label={phase?.name ?? S.noPhase}
      className={cn(
        "flex min-h-44 min-w-72 flex-1 basis-72 flex-col gap-2 rounded-lg bg-canvas-subtle p-2 max-md:snap-start md:max-w-md",
        isOver && "ring-2 ring-ring",
      )}
    >
      <header className="space-y-1.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {phase?.name ?? S.noPhase}
          </h2>
          <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
            {done.length}/{ordered.length}
          </span>
        </div>
        <span aria-hidden="true" className="block h-0.5 overflow-hidden rounded-full bg-track">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </span>
      </header>

      {active.length === 0 && ordered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-6 text-center">
          <p className="text-meta text-muted-foreground">No tasks yet.</p>
          {canEdit && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="task-add"
              onClick={onAddTask}
            >
              + {S.add}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {active.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEdit}
                now={now}
                onOpen={() => onOpenTask(task)}
                onToggleDone={(next) => onToggleDone(task, next)}
              />
            ))}
          </div>
          {done.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((value) => !value)}
                className="flex items-center gap-1 px-1 py-0.5 text-left text-meta text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn("size-3.5 transition-transform", showDone && "rotate-90")}
                />
                {showDone ? "Hide" : "Show"} {done.length} completed
              </button>
              {showDone && (
                <div className="flex flex-col gap-1">
                  {done.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canEdit={canEdit}
                      now={now}
                      onOpen={() => onOpenTask(task)}
                      onToggleDone={(next) => onToggleDone(task, next)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {canEdit && ordered.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="task-add"
              onClick={onAddTask}
              className="justify-start text-muted-foreground"
            >
              + {S.add}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
