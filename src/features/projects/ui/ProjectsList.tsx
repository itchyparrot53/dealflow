"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { Select } from "@/components/ui/Select";
import { tableStyles } from "@/components/ui/table-styles";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import type { ProjectListItem } from "../types";
import { NewProjectDialog } from "./NewProjectDialog";

const S = PROJECTS_API_STRINGS.projects;

const STATUS_OPTIONS = [
  { value: "", label: S.allStatuses },
  { value: "active", label: S.statuses.active },
  { value: "on_hold", label: S.statuses.on_hold },
  { value: "completed", label: S.statuses.completed },
  { value: "cancelled", label: S.statuses.cancelled },
];

const STATUS_VARIANT = {
  active: "default",
  on_hold: "secondary",
  completed: "success",
  cancelled: "destructive",
} as const;

export function ProjectsList({
  projects,
  users,
  dealOptions,
  filters,
}: {
  projects: ProjectListItem[];
  users: { id: string; name: string }[];
  dealOptions: { id: string; title: string }[];
  filters: { status?: string; ownerId?: string; search?: string };
}): React.ReactNode {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search ?? "");
  const [newOpen, setNewOpen] = useState(false);

  function push(next: { status?: string; ownerId?: string; search?: string }): void {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status !== undefined && merged.status !== "") params.set("status", merged.status);
    if (merged.ownerId !== undefined && merged.ownerId !== "")
      params.set("ownerId", merged.ownerId);
    if (merged.search !== undefined && merged.search !== "") params.set("search", merged.search);
    const query = params.toString();
    router.push(query === "" ? "/projects" : `/projects?${query}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" data-testid="project-new" onClick={() => setNewOpen(true)}>
          {S.newProject}
        </Button>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            push({ search });
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={S.search}
            aria-label={S.search}
            className="h-8 w-56"
          />
        </form>
        <Select
          value={filters.status ?? ""}
          onChange={(value) => push({ status: value })}
          options={STATUS_OPTIONS}
          ariaLabel={S.status}
          triggerClassName="h-8"
        />
        <Select
          value={filters.ownerId ?? ""}
          onChange={(value) => push({ ownerId: value })}
          options={[
            { value: "", label: S.allOwners },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ]}
          ariaLabel={S.owner}
          triggerClassName="h-8"
        />
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table data-testid="projects-table" className={tableStyles.table}>
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className={tableStyles.th}>{S.name}</th>
                <th className={tableStyles.th}>{S.status}</th>
                <th className={tableStyles.th}>{S.linkedDeal}</th>
                <th className={tableStyles.th}>{S.owner}</th>
                <th className={tableStyles.th}>{S.progress}</th>
                <th className={tableStyles.th}>{S.dueDate}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  data-testid="project-row"
                  data-project-id={project.id}
                  className="border-t hover:bg-accent/40"
                >
                  <td className={tableStyles.td}>
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/projects/${project.id}`}
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className={tableStyles.td}>
                    <Badge variant={STATUS_VARIANT[project.status]}>
                      {S.statuses[project.status]}
                    </Badge>
                  </td>
                  <td className={tableStyles.td}>
                    {project.dealId === null ? (
                      <span className="text-muted-foreground">{S.noDeal}</span>
                    ) : (
                      <Link className="hover:underline" href={`/deals/${project.dealId}`}>
                        {project.dealTitle ?? project.dealId}
                      </Link>
                    )}
                  </td>
                  <td className={tableStyles.td}>{project.ownerName}</td>
                  <td className={tableStyles.td}>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={project.doneCount}
                        max={project.taskCount === 0 ? 1 : project.taskCount}
                        label={S.task.progress(project.doneCount, project.taskCount)}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">
                        {S.task.progress(project.doneCount, project.taskCount)}
                      </span>
                    </div>
                  </td>
                  <td className={tableStyles.td}>{project.dueDate ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        users={users}
        dealOptions={dealOptions}
      />
    </div>
  );
}
