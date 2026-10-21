"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { PROJECT_DEFAULT_PHASES } from "@/constants/projectsApi";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createProjectAction } from "../actions";
import type { ProjectView } from "../types";

const S = PROJECTS_API_STRINGS.projects;

export function NewProjectDialog({
  open,
  onOpenChange,
  users,
  dealOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: { id: string; name: string }[];
  dealOptions: { id: string; title: string }[];
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dealId, setDealId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const nextPhaseId = useRef(PROJECT_DEFAULT_PHASES.length);
  const [phases, setPhases] = useState<{ id: number; name: string }[]>(
    PROJECT_DEFAULT_PHASES.map((name, id) => ({ id, name })),
  );
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset(): void {
    setName("");
    setDealId("");
    setOwnerId("");
    setStartDate(null);
    setDueDate(null);
    nextPhaseId.current = PROJECT_DEFAULT_PHASES.length;
    setPhases(PROJECT_DEFAULT_PHASES.map((name, id) => ({ id, name })));
    setErrorId(null);
  }

  async function create(): Promise<void> {
    if (name.trim() === "") return;
    setPending(true);
    setErrorId(null);
    const response = await createProjectAction(
      {
        name: name.trim(),
        dealId: dealId === "" ? undefined : dealId,
        ownerId: ownerId === "" ? undefined : ownerId,
        startDate,
        dueDate,
        phases: phases.map((phase) => phase.name.trim()).filter((phase) => phase !== ""),
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    const created = response.value as ProjectView;
    reset();
    onOpenChange(false);
    router.push(`/projects/${created.id}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{S.newProject}</DialogTitle>
          <DialogDescription>{S.newProjectDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {errorId !== null && (
            <p role="alert" className="text-sm text-destructive">
              {projectsErrorMessage(errorId)}
            </p>
          )}
          <label className="block text-sm font-medium" htmlFor="project-name">
            {S.name}
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={S.name}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm font-medium">{S.linkedDeal}</span>
              <Combobox
                value={dealId}
                onChange={setDealId}
                options={[
                  { value: "", label: S.noDeal },
                  ...dealOptions.map((deal) => ({ value: deal.id, label: deal.title })),
                ]}
                ariaLabel={S.linkedDeal}
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">{S.owner}</span>
              <Combobox
                value={ownerId}
                onChange={setOwnerId}
                options={[
                  { value: "", label: S.allOwners },
                  ...users.map((user) => ({ value: user.id, label: user.name })),
                ]}
                ariaLabel={S.owner}
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">{S.startDate}</span>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                ariaLabel={S.startDate}
                placeholder={S.startDate}
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">{S.dueDate}</span>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                ariaLabel={S.dueDate}
                placeholder={S.dueDate}
              />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">{S.phases}</span>
            <ul className="space-y-1">
              {phases.map((phase, index) => (
                <li key={phase.id} className="flex items-center gap-2">
                  <Input
                    value={phase.name}
                    onChange={(event) =>
                      setPhases((current) =>
                        current.map((row) =>
                          row.id === phase.id ? { ...row, name: event.target.value } : row,
                        ),
                      )
                    }
                    aria-label={`${S.phases} ${index + 1}`}
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPhases((current) => current.filter((row) => row.id !== phase.id))
                    }
                  >
                    {S.removePhase}
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() =>
                setPhases((current) => [...current, { id: nextPhaseId.current++, name: "" }])
              }
            >
              {S.addPhase}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {S.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || name.trim() === ""}
            onClick={() => void create()}
          >
            {pending ? S.creating : S.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
