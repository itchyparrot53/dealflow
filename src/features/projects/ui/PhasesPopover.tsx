"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { addPhaseAction, deletePhaseAction, movePhaseAction, renamePhaseAction } from "../actions";
import type { PhaseView } from "../types";

const S = PROJECTS_API_STRINGS.projects;

function PhaseRow({
  projectId,
  phase,
  index,
  count,
  canEdit,
  onChanged,
}: {
  projectId: string;
  phase: PhaseView;
  index: number;
  count: number;
  canEdit: boolean;
  onChanged: (phases: PhaseView[]) => void;
}): React.ReactNode {
  const [name, setName] = useState(phase.name);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function rename(): Promise<void> {
    if (name.trim() === "" || name.trim() === phase.name) {
      setName(phase.name);
      return;
    }
    const response = await renamePhaseAction(
      projectId,
      { phaseId: phase.id, name: name.trim() },
      readCsrfToken(),
    );
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    onChanged(response.value as PhaseView[]);
  }

  async function move(position: number): Promise<void> {
    const response = await movePhaseAction(
      projectId,
      { phaseId: phase.id, position },
      readCsrfToken(),
    );
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    onChanged(response.value as PhaseView[]);
  }

  async function remove(): Promise<void> {
    const response = await deletePhaseAction(projectId, { phaseId: phase.id }, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    onChanged(response.value as PhaseView[]);
  }

  return (
    <li className="flex items-center gap-1">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void rename()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void rename();
        }}
        aria-label={S.phases}
        disabled={!canEdit}
        className="h-8"
      />
      {canEdit && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${phase.name} up`}
            disabled={index === 0}
            onClick={() => void move(index - 1)}
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${phase.name} down`}
            disabled={index === count - 1}
            onClick={() => void move(index + 1)}
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${S.removePhase} ${phase.name}`}
            onClick={() => void remove()}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      )}
      {errorId !== null && <span className="sr-only">{projectsErrorMessage(errorId)}</span>}
    </li>
  );
}

export function PhasesPopover({
  projectId,
  phases,
  canEdit,
  onChanged,
}: {
  projectId: string;
  phases: PhaseView[];
  canEdit: boolean;
  onChanged: (phases: PhaseView[]) => void;
}): React.ReactNode {
  const [name, setName] = useState("");
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add(): Promise<void> {
    if (name.trim() === "") return;
    setPending(true);
    setErrorId(null);
    const response = await addPhaseAction(projectId, { name: name.trim() }, readCsrfToken());
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setName("");
    onChanged(response.value as PhaseView[]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {S.phases}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          {errorId !== null && (
            <p role="alert" className="text-sm text-destructive">
              {projectsErrorMessage(errorId)}
            </p>
          )}
          <ul className="space-y-1">
            {phases.map((phase, index) => (
              <PhaseRow
                key={phase.id}
                projectId={projectId}
                phase={phase}
                index={index}
                count={phases.length}
                canEdit={canEdit}
                onChanged={onChanged}
              />
            ))}
          </ul>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={S.addPhase}
                aria-label={S.addPhase}
                className="h-8"
              />
              <Button type="button" size="sm" disabled={pending} onClick={() => void add()}>
                {S.addPhase}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
