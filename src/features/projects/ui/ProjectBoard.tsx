"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ArrowLeft, CheckCircle2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { useToastStore } from "@/features/feedback/toastStore";
import { daysUntil } from "@/lib/format/date";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  completeTaskAction,
  deleteProjectAction,
  moveTaskAction,
  reopenTaskAction,
  setProjectStatusAction,
  updateProjectAction,
} from "../actions";
import type { PhaseView, ProjectView, TaskView } from "../types";
import { applyMove } from "./boardMove";
import { PhaseColumn } from "./PhaseColumn";
import { PhasesPopover } from "./PhasesPopover";
import { ProjectDueDate, ProjectProgress } from "./ProjectChrome";
import { ProjectDates } from "./ProjectDates";
import { ProjectOverview } from "./ProjectOverview";
import { ProjectStatusMenu } from "./ProjectStatusMenu";
import { ProjectTaskList } from "./ProjectTaskList";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";

const S = PROJECTS_API_STRINGS.projects;

export function ProjectBoard({
  project,
  users,
  canEdit,
  today,
}: {
  project: ProjectView;
  users: { id: string; name: string }[];
  canEdit: boolean;
  today: string;
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus] = useState(project.status);
  const [view, setView] = useState<"board" | "list">("board");
  const [now] = useState(() => new Date(`${today}T12:00:00.000Z`));
  const [startDate, setStartDate] = useState<string | null>(project.startDate);
  const [dueDate, setDueDate] = useState<string | null>(project.dueDate);
  const [phases, setPhases] = useState<PhaseView[]>(project.phases);
  const [tasks, setTasks] = useState<TaskView[]>(project.tasks);
  const [errorId, setErrorId] = useState<string | null>(null);

  // The board's ad-hoc inline alert became the shared error toast (6.8); dialog-level field
  // validation keeps its own inline copy.
  useEffect(() => {
    if (errorId !== null) {
      useToastStore.getState().push({ message: projectsErrorMessage(errorId), tone: "error" });
    }
  }, [errorId]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<{
    task: TaskView | null;
    phaseId: string | null;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);

  // Mouse drags from an 8 px movement; touch drags only after a short hold so a swipe over a card
  // still scrolls the column, and keyboard users can move a focused card with arrow keys.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  async function saveName(): Promise<void> {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === project.name) {
      setName(project.name);
      setEditingName(false);
      return;
    }
    const response = await updateProjectAction(project.id, { name: trimmed }, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setName(trimmed);
    setEditingName(false);
    router.refresh();
  }

  async function changeStatus(next: string, announce = true): Promise<void> {
    if (next === status) return;
    const previous = status;
    const response = await setProjectStatusAction(project.id, next, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setStatus(next as ProjectView["status"]);
    if (announce) {
      useToastStore.getState().push({
        message: `Project marked ${next.replace("_", " ")}.`,
        action: {
          label: "Undo",
          run: async () => {
            await changeStatus(previous, false);
            return { ok: true, value: undefined };
          },
        },
      });
    }
    router.refresh();
  }

  async function changeDate(field: "startDate" | "dueDate", value: string | null): Promise<void> {
    const response = await updateProjectAction(project.id, { [field]: value }, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    if (field === "startDate") setStartDate(value);
    else setDueDate(value);
    router.refresh();
  }

  async function removeProject(): Promise<void> {
    setPending(true);
    const response = await deleteProjectAction(project.id, readCsrfToken());
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    router.push("/projects");
  }

  function saveTask(task: TaskView): void {
    setTasks((previous) =>
      previous.some((row) => row.id === task.id)
        ? previous.map((row) => (row.id === task.id ? task : row))
        : [...previous, task],
    );
    router.refresh();
  }

  async function toggleDone(task: TaskView, done: boolean): Promise<void> {
    const response = done
      ? await completeTaskAction(project.id, { taskId: task.id }, readCsrfToken())
      : await reopenTaskAction(project.id, { taskId: task.id }, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    saveTask(response.value as TaskView);
  }

  function onDragStart(event: DragStartEvent): void {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent): Promise<void> {
    setActiveId(null);
    const taskId = String(event.active.id);
    const over = event.over;
    if (over === null) return;
    const overId = String(over.id);
    let targetPhaseId: string | null;
    let index: number;
    if (overId.startsWith("phase:")) {
      const raw = overId.slice("phase:".length);
      targetPhaseId = raw === "none" ? null : raw;
      index = tasks.filter((task) => task.phaseId === targetPhaseId && task.id !== taskId).length;
    } else {
      const overTask = tasks.find((task) => task.id === overId);
      if (overTask === undefined) return;
      targetPhaseId = overTask.phaseId;
      const column = tasks
        .filter((task) => task.phaseId === targetPhaseId && task.id !== taskId)
        .sort((a, b) => a.position - b.position);
      index = column.findIndex((task) => task.id === overTask.id);
      if (index < 0) index = column.length;
    }

    const previous = tasks;
    setTasks(applyMove(tasks, taskId, targetPhaseId, index));
    const response = await moveTaskAction(
      project.id,
      { taskId, phaseId: targetPhaseId, position: index },
      readCsrfToken(),
    );
    if (!response.ok) {
      setTasks(previous);
      setErrorId("E_PROJECT_004");
      return;
    }
    setTasks(response.value as TaskView[]);
    router.refresh();
  }

  const activeTask =
    activeId === null ? null : (tasks.find((task) => task.id === activeId) ?? null);
  const hasNoPhaseTasks = tasks.some((task) => task.phaseId === null);
  const doneCount = tasks.filter((task) => task.done).length;
  const overdueCount = tasks.filter(
    (task) =>
      !task.done &&
      task.dueDate !== null &&
      task.dueDate !== "" &&
      (daysUntil(task.dueDate, now) ?? 0) < 0,
  ).length;
  const allDone = tasks.length > 0 && tasks.every((task) => task.done);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          {S.backToProjects}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {editingName && canEdit ? (
                <Input
                  value={name}
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => void saveName()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveName();
                    if (event.key === "Escape") {
                      setName(project.name);
                      setEditingName(false);
                    }
                  }}
                  aria-label={S.name}
                  className="max-w-md"
                />
              ) : (
                <h1 className="truncate text-title">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      if (canEdit) setEditingName(true);
                    }}
                  >
                    {name}
                  </button>
                </h1>
              )}
              <ProjectStatusMenu
                status={status}
                canEdit={canEdit}
                onChange={(next) => void changeStatus(next)}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-muted-foreground">
              <ProjectProgress done={doneCount} total={tasks.length} />
              <span className="flex items-center gap-2">
                <Avatar name={project.ownerName} className="size-5 text-caption" />
                <span className="text-foreground">{project.ownerName}</span>
              </span>
              <ProjectDueDate value={dueDate} now={now} />
              {overdueCount > 0 && (
                <span className="font-medium text-destructive">
                  {overdueCount} {overdueCount === 1 ? "task" : "tasks"} overdue
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PhasesPopover
              projectId={project.id}
              phases={phases}
              taskCounts={tasks.reduce<Record<string, number>>((counts, task) => {
                if (task.phaseId !== null) counts[task.phaseId] = (counts[task.phaseId] ?? 0) + 1;
                return counts;
              }, {})}
              canEdit={canEdit}
              onChanged={(next) => {
                setPhases(next);
                router.refresh();
              }}
            />
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="Project actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void changeStatus("completed")}>
                    {S.actions.complete}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void changeStatus("on_hold")}>
                    {S.actions.putOnHold}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void changeStatus("cancelled")}>
                    {S.actions.cancel}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirmDelete(true)}>
                    {S.actions.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <ProjectOverview projectId={project.id} description={project.description} canEdit={canEdit} />

      {allDone && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            All tasks are done.
          </span>
          {canEdit && status !== "completed" && (
            <Button size="sm" variant="secondary" onClick={() => void changeStatus("completed")}>
              {S.actions.complete}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="inline-flex rounded-md border bg-card p-0.5" aria-label="Project view">
          <legend className="sr-only">Project view</legend>
          <button
            type="button"
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
            className={`h-7 rounded px-2.5 text-meta font-medium transition-colors duration-100 ${
              view === "board"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Board
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`h-7 rounded px-2.5 text-meta font-medium transition-colors duration-100 ${
              view === "list"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            List
          </button>
        </fieldset>
        <ProjectDates
          startDate={startDate}
          dueDate={dueDate}
          canEdit={canEdit}
          now={now}
          onChange={(field, value) => void changeDate(field, value)}
        />
      </div>

      {view === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={(event) => void onDragEnd(event)}
        >
          <div
            data-testid="project-board"
            className="flex gap-3 overflow-x-auto pb-2 max-md:snap-x max-md:snap-mandatory"
          >
            {phases.map((phase) => (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                tasks={tasks.filter((task) => task.phaseId === phase.id)}
                canEdit={canEdit}
                now={now}
                onAddTask={() => setPendingTask({ task: null, phaseId: phase.id })}
                onOpenTask={(task) => setPendingTask({ task, phaseId: task.phaseId })}
                onToggleDone={(task, done) => void toggleDone(task, done)}
              />
            ))}
            {(hasNoPhaseTasks || phases.length === 0) && (
              <PhaseColumn
                phase={null}
                tasks={tasks.filter((task) => task.phaseId === null)}
                canEdit={canEdit}
                now={now}
                onAddTask={() => setPendingTask({ task: null, phaseId: null })}
                onOpenTask={(task) => setPendingTask({ task, phaseId: null })}
                onToggleDone={(task, done) => void toggleDone(task, done)}
              />
            )}
          </div>
          <DragOverlay>
            {activeTask === null ? null : (
              <TaskCard
                task={activeTask}
                canEdit={false}
                now={now}
                overlay
                onOpen={() => undefined}
                onToggleDone={() => undefined}
              />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <ProjectTaskList
          tasks={tasks}
          phases={phases}
          canEdit={canEdit}
          now={now}
          onOpenTask={(task) => setPendingTask({ task, phaseId: task.phaseId })}
          onToggleDone={(task, done) => void toggleDone(task, done)}
        />
      )}

      {pendingTask !== null && (
        <TaskDialog
          // Remounting per task gives the form fresh field state without a setState effect.
          key={pendingTask.task?.id ?? `new:${pendingTask.phaseId ?? "none"}`}
          open
          onOpenChange={(open) => {
            if (!open) setPendingTask(null);
          }}
          projectId={project.id}
          task={pendingTask.task}
          defaultPhaseId={pendingTask.phaseId}
          phases={phases}
          users={users}
          canEdit={canEdit}
          onSaved={saveTask}
          onMoved={(next) => {
            setTasks(next);
            router.refresh();
          }}
          onDeleted={(id) => {
            setTasks((previous) => previous.filter((task) => task.id !== id));
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={S.actions.confirmDelete}
        description={S.actions.confirmDeleteBody}
        confirmLabel={S.actions.delete}
        destructive
        pending={pending}
        onConfirm={() => void removeProject()}
      />
    </div>
  );
}
