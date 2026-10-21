"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { useToastStore } from "@/features/feedback/toastStore";
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
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";

const S = PROJECTS_API_STRINGS.projects;

const STATUS_OPTIONS = [
  { value: "active", label: S.statuses.active },
  { value: "on_hold", label: S.statuses.on_hold },
  { value: "completed", label: S.statuses.completed },
  { value: "cancelled", label: S.statuses.cancelled },
];

export function ProjectBoard({
  project,
  users,
  canEdit,
}: {
  project: ProjectView;
  users: { id: string; name: string }[];
  canEdit: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus] = useState(project.status);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  async function changeStatus(next: string): Promise<void> {
    const response = await setProjectStatusAction(project.id, next, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setStatus(next as ProjectView["status"]);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
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
            <h1 className="truncate text-display font-[450] leading-tight tracking-tight">
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
          <p className="text-sm text-muted-foreground">
            {S.task.progress(doneCount, tasks.length)}
            {project.dealId !== null && (
              <>
                {" · "}
                <Link className="underline" href={`/deals/${project.dealId}`}>
                  {project.dealTitle ?? S.linkedDeal}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onChange={(next) => void changeStatus(next)}
            options={STATUS_OPTIONS}
            ariaLabel={S.status}
            testId="project-status"
            disabled={!canEdit}
          />
          <PhasesPopover
            projectId={project.id}
            phases={phases}
            canEdit={canEdit}
            onChanged={(next) => {
              setPhases(next);
              router.refresh();
            }}
          />
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label={S.board}>
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
          <Link href="/projects" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {S.backToProjects}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          {S.startDate}
          <DatePicker
            value={startDate}
            onChange={(value) => void changeDate("startDate", value)}
            ariaLabel={S.startDate}
            placeholder={S.startDate}
          />
        </span>
        <span className="flex items-center gap-2">
          {S.dueDate}
          <DatePicker
            value={dueDate}
            onChange={(value) => void changeDate("dueDate", value)}
            ariaLabel={S.dueDate}
            placeholder={S.dueDate}
          />
        </span>
        <span className="text-muted-foreground">
          {S.owner}: {project.ownerName}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={(event) => void onDragEnd(event)}
      >
        <div data-testid="project-board" className="flex gap-3 overflow-x-auto pb-2">
          {phases.map((phase) => (
            <PhaseColumn
              key={phase.id}
              phase={phase}
              tasks={tasks.filter((task) => task.phaseId === phase.id)}
              canEdit={canEdit}
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
              overlay
              onOpen={() => undefined}
              onToggleDone={() => undefined}
            />
          )}
        </DragOverlay>
      </DndContext>

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
