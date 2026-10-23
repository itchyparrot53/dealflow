"use client";

import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import type { ProjectStatus } from "../types";
import { ProjectStatusLabel } from "./ProjectChrome";

const S = PROJECTS_API_STRINGS.projects;

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: S.statuses.active },
  { value: "on_hold", label: S.statuses.on_hold },
  { value: "completed", label: S.statuses.completed },
  { value: "cancelled", label: S.statuses.cancelled },
];

// The status control by the project title: a quiet label that opens the four valid states.
export function ProjectStatusMenu({
  status,
  canEdit,
  onChange,
}: {
  status: ProjectStatus;
  canEdit: boolean;
  onChange: (next: string) => void;
}): React.ReactNode {
  if (!canEdit) return <ProjectStatusLabel status={status} className="px-2" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="project-status"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ProjectStatusLabel status={status} />
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            <ProjectStatusLabel status={option.value} />
            {option.value === status ? (
              <Check aria-hidden="true" className="ml-auto size-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
