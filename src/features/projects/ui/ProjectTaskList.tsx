"use client";

import type React from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { cn } from "@/lib/utils";
import type { PhaseView, TaskView } from "../types";
import { ProjectDueDate } from "./ProjectChrome";

const S = PROJECTS_API_STRINGS.projects.task;

// The list alternative to the board: the same tasks, sorted by phase then position, scanned as
// rows. It keeps the checkbox and the open-task dialog, but no drag; reading a 40-task project
// should not require panning three columns.
export function ProjectTaskList({
  tasks,
  phases,
  canEdit,
  now,
  onOpenTask,
  onToggleDone,
}: {
  tasks: TaskView[];
  phases: PhaseView[];
  canEdit: boolean;
  now: Date;
  onOpenTask: (task: TaskView) => void;
  onToggleDone: (task: TaskView, done: boolean) => void;
}): React.ReactNode {
  const phaseName = new Map(phases.map((phase) => [phase.id, phase.name]));
  const phaseOrder = new Map(phases.map((phase) => [phase.id, phase.position]));
  const ordered = [...tasks].sort((a, b) => {
    const phaseA = a.phaseId === null ? -1 : (phaseOrder.get(a.phaseId) ?? 0);
    const phaseB = b.phaseId === null ? -1 : (phaseOrder.get(b.phaseId) ?? 0);
    return phaseA === phaseB ? a.position - b.position : phaseA - phaseB;
  });

  return (
    <div
      data-testid="project-task-list"
      className="w-full overflow-x-auto rounded-lg border bg-card [contain:paint]"
    >
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-left">
          <tr className="border-b">
            <th className="w-10 px-2 py-2">
              <span className="sr-only">Done</span>
            </th>
            <th className="px-3 py-2 text-meta font-medium text-muted-foreground">{S.title}</th>
            <th className="w-40 px-3 py-2 text-meta font-medium text-muted-foreground">
              {PROJECTS_API_STRINGS.projects.phases}
            </th>
            <th className="w-44 px-3 py-2 text-meta font-medium text-muted-foreground">
              {S.assignee}
            </th>
            <th className="w-36 px-3 py-2 text-meta font-medium text-muted-foreground">
              {S.dueDate}
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((task) => (
            <tr
              key={task.id}
              data-testid="task-list-row"
              className="border-t transition-colors duration-100 hover:bg-accent/40"
            >
              <td className="px-2 py-2 align-middle">
                <Checkbox
                  checked={task.done}
                  onCheckedChange={(done) => onToggleDone(task, done)}
                  label={task.done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                  disabled={!canEdit}
                />
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className={cn(
                    "min-w-0 text-left font-medium text-foreground hover:underline",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </button>
              </td>
              <td className="px-3 py-2 text-meta text-muted-foreground">
                {task.phaseId === null ? S.noPhase : (phaseName.get(task.phaseId) ?? S.noPhase)}
              </td>
              <td className="px-3 py-2 text-meta text-muted-foreground">
                {task.assigneeName ?? S.unassigned}
              </td>
              <td className="px-3 py-2">
                {task.dueDate === null || task.dueDate === "" ? (
                  <span className="text-meta text-muted-foreground">No due date</span>
                ) : (
                  <ProjectDueDate value={task.dueDate} now={now} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
