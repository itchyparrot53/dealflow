"use client";

import type React from "react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  addTaskAction,
  completeTaskAction,
  deleteTaskAction,
  moveTaskAction,
  reopenTaskAction,
  updateTaskAction,
} from "../actions";
import type { PhaseView, TaskView } from "../types";

const S = PROJECTS_API_STRINGS.projects;

export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  defaultPhaseId,
  phases,
  users,
  canEdit,
  onSaved,
  onMoved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task: TaskView | null;
  defaultPhaseId: string | null;
  phases: PhaseView[];
  users: { id: string; name: string }[];
  canEdit: boolean;
  onSaved: (task: TaskView) => void;
  onMoved: (tasks: TaskView[]) => void;
  onDeleted: (id: string) => void;
}): React.ReactNode {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? null);
  const [phaseId, setPhaseId] = useState<string | null>(task?.phaseId ?? defaultPhaseId);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(): Promise<void> {
    if (title.trim() === "") {
      setErrorId(null);
      return;
    }
    setPending(true);
    setErrorId(null);
    const payload = {
      title: title.trim(),
      description: description === "" ? null : description,
      assigneeId: assigneeId === "" ? null : assigneeId,
      dueDate,
    };
    if (task === null) {
      const response = await addTaskAction(projectId, { ...payload, phaseId }, readCsrfToken());
      setPending(false);
      if (!response.ok) {
        setErrorId(response.error.id);
        return;
      }
      onSaved(response.value as TaskView);
      onOpenChange(false);
      return;
    }

    const updated = await updateTaskAction(
      projectId,
      { taskId: task.id, ...payload },
      readCsrfToken(),
    );
    if (!updated.ok) {
      setPending(false);
      setErrorId(updated.error.id);
      return;
    }
    if (phaseId !== task.phaseId) {
      const moved = await moveTaskAction(
        projectId,
        { taskId: task.id, phaseId, position: 10_000 },
        readCsrfToken(),
      );
      setPending(false);
      if (!moved.ok) {
        setErrorId(moved.error.id);
        return;
      }
      onMoved(moved.value as TaskView[]);
    } else {
      setPending(false);
    }
    onSaved(updated.value as TaskView);
    onOpenChange(false);
  }

  async function setDone(done: boolean): Promise<void> {
    if (task === null) return;
    const response = done
      ? await completeTaskAction(projectId, { taskId: task.id }, readCsrfToken())
      : await reopenTaskAction(projectId, { taskId: task.id }, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    onSaved(response.value as TaskView);
  }

  async function remove(): Promise<void> {
    if (task === null) return;
    setPending(true);
    const response = await deleteTaskAction(projectId, { taskId: task.id }, readCsrfToken());
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    onDeleted(task.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="task-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task === null ? S.task.newTitle : S.task.title}</DialogTitle>
          <DialogDescription>{S.task.dialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            {errorId !== null && (
              <p role="alert" className="text-sm text-danger">
                {projectsErrorMessage(errorId)}
              </p>
            )}
            <FormField label={S.task.title} htmlFor="task-title">
              <Input
                id="task-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!canEdit || pending}
                aria-label={S.task.title}
              />
            </FormField>
            <FormField label={S.task.description} htmlFor="task-description">
              <Textarea
                id="task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEdit || pending}
                aria-label={S.task.description}
              />
            </FormField>
            <FormGrid columns={2}>
              <FormField label={S.task.assignee}>
                <Combobox
                  value={assigneeId}
                  onChange={setAssigneeId}
                  options={[
                    { value: "", label: S.task.unassigned },
                    ...users.map((user) => ({ value: user.id, label: user.name })),
                  ]}
                  ariaLabel={S.task.assignee}
                  disabled={!canEdit || pending}
                />
              </FormField>
              <FormField label={S.task.phase}>
                <Select
                  value={phaseId ?? ""}
                  onChange={(next) => setPhaseId(next === "" ? null : next)}
                  options={[
                    { value: "", label: S.task.noPhase },
                    ...phases.map((phase) => ({ value: phase.id, label: phase.name })),
                  ]}
                  ariaLabel={S.task.phase}
                  disabled={!canEdit || pending}
                />
              </FormField>
              <FormField label={S.task.dueDate}>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  ariaLabel={S.task.dueDate}
                  placeholder={S.task.dueDate}
                />
              </FormField>
              {task !== null && (
                <div className="flex items-end pb-2">
                  <Checkbox
                    checked={task.done}
                    onCheckedChange={(done) => void setDone(done)}
                    label={S.task.done}
                    disabled={!canEdit || pending}
                  />
                  <span className="ml-2 text-sm">{S.task.done}</span>
                </div>
              )}
            </FormGrid>
          </div>
        </DialogBody>
        <DialogFooter>
          {task !== null && canEdit && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              {S.task.delete}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {S.cancel}
          </Button>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              disabled={pending || title.trim() === ""}
              onClick={() => void save()}
            >
              {pending ? S.saving : task === null ? S.task.create : S.save}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={S.task.confirmDelete}
        description={S.task.confirmDeleteBody}
        confirmLabel={S.task.delete}
        destructive
        pending={pending}
        onConfirm={() => void remove()}
      />
    </Dialog>
  );
}
