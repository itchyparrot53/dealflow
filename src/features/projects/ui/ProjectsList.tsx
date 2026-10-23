"use client";

import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyCell } from "@/components/ui/table-parts";
import { tableStyles } from "@/components/ui/table-styles";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { daysUntil } from "@/lib/format/date";
import type { ProjectListItem } from "../types";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectDueDate, ProjectProgress, ProjectStatusLabel } from "./ProjectChrome";

const S = PROJECTS_API_STRINGS.projects;

const STATUS_OPTIONS = [
  { value: "", label: S.allStatuses },
  { value: "active", label: S.statuses.active },
  { value: "on_hold", label: S.statuses.on_hold },
  { value: "completed", label: S.statuses.completed },
  { value: "cancelled", label: S.statuses.cancelled },
];

interface Stats {
  active: number;
  completion: string;
  dueSoon: number;
  overdue: number;
}

// The numbers a project lead checks first, derived from the rows already on screen so the strip
// never disagrees with the table below it.
function projectStats(projects: ProjectListItem[], now: Date): Stats {
  let totalTasks = 0;
  let doneTasks = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const project of projects) {
    totalTasks += project.taskCount;
    doneTasks += project.doneCount;
    if (project.status === "completed" || project.status === "cancelled") continue;
    if (project.dueDate === null || project.dueDate === "") continue;
    const days = daysUntil(project.dueDate, now);
    if (days === null) continue;
    if (days < 0) overdue += 1;
    else if (days <= 14) dueSoon += 1;
  }
  return {
    active: projects.filter((project) => project.status === "active").length,
    completion: totalTasks === 0 ? "No tasks" : `${Math.round((doneTasks / totalTasks) * 100)}%`,
    dueSoon,
    overdue,
  };
}

function StatCell({ label, value }: { label: string; value: number | string }): React.ReactNode {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function ProjectsList({
  projects,
  users,
  dealOptions,
  filters,
  today,
}: {
  projects: ProjectListItem[];
  users: { id: string; name: string }[];
  dealOptions: { id: string; title: string }[];
  filters: { status?: string; ownerId?: string; search?: string };
  // Calendar date from the server so relative labels and stats are stable across hydration.
  today: string;
}): React.ReactNode {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search ?? "");
  const [newOpen, setNewOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useMemo(() => new Date(`${today}T12:00:00.000Z`), [today]);
  // The URL owns the search term: Back, Forward and shared links must resync the input, and
  // typing filters after a short pause instead of waiting for Enter.
  useEffect(() => {
    // Back, Forward and a shared link change the URL; the controlled input has to follow it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL to controlled-input sync
    setSearch(filters.search ?? "");
  }, [filters.search]);
  useEffect(
    () => () => {
      if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    },
    [],
  );
  const stats = useMemo(() => projectStats(projects, now), [projects, now]);
  const hasFilters =
    (filters.status !== undefined && filters.status !== "") ||
    (filters.ownerId !== undefined && filters.ownerId !== "") ||
    (filters.search !== undefined && filters.search !== "");

  function push(
    next: { status?: string; ownerId?: string; search?: string },
    replace = false,
  ): void {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status !== undefined && merged.status !== "") params.set("status", merged.status);
    if (merged.ownerId !== undefined && merged.ownerId !== "")
      params.set("ownerId", merged.ownerId);
    if (merged.search !== undefined && merged.search !== "") params.set("search", merged.search);
    const query = params.toString();
    const href = query === "" ? "/projects" : `/projects?${query}`;
    if (replace) router.replace(href);
    else router.push(href);
  }

  function changeSearch(value: string): void {
    setSearch(value);
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => push({ search: value }, true), 300);
  }

  function clearFilters(): void {
    setSearch("");
    router.push("/projects");
  }

  return (
    <div className="w-full min-w-0 space-y-3 overflow-x-clip">
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
            onChange={(event) => changeSearch(event.target.value)}
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
          triggerClassName="h-8 w-44"
        />
        <Select
          value={filters.ownerId ?? ""}
          onChange={(value) => push({ ownerId: value })}
          options={[
            { value: "", label: S.allOwners },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ]}
          ariaLabel={S.owner}
          triggerClassName="h-8 w-44"
        />
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-meta text-muted-foreground tabular-nums">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
      </div>

      {projects.length > 0 && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
          <StatCell label="Active" value={stats.active} />
          <StatCell label="Task completion" value={stats.completion} />
          <StatCell label="Due in 14 days" value={stats.dueSoon} />
          <StatCell label="Overdue" value={stats.overdue} />
        </dl>
      )}

      {projects.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="No projects match these filters."
            body="Clear the filters, or search a different name."
            icon={<FolderKanban aria-hidden="true" />}
            action={
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
            className="py-10"
          />
        ) : (
          <EmptyState
            title="No projects yet."
            body="Create one, or start from a won deal."
            icon={<FolderKanban aria-hidden="true" />}
            action={
              <Button size="sm" onClick={() => setNewOpen(true)}>
                {S.newProject}
              </Button>
            }
            className="py-10"
          />
        )
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {projects.map((project) => (
              <li
                key={project.id}
                data-testid="project-card"
                data-project-id={project.id}
                className="rounded-lg border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    className="min-w-0 font-medium text-foreground underline-offset-2 hover:underline"
                    href={`/projects/${project.id}`}
                  >
                    {project.name}
                  </Link>
                  <ProjectStatusLabel status={project.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <ProjectProgress done={project.doneCount} total={project.taskCount} />
                  <ProjectDueDate value={project.dueDate} now={now} className="items-end" />
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
                  <Avatar name={project.ownerName} className="size-5 shrink-0 text-caption" />
                  <span className="truncate">{project.ownerName}</span>
                  {project.dealId !== null && (
                    <Link
                      className="ml-auto max-w-[45%] truncate text-foreground hover:underline"
                      href={`/deals/${project.dealId}`}
                    >
                      {project.dealTitle ?? "Linked deal"}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden w-full max-w-full overflow-x-auto rounded-lg border bg-card [contain:paint] md:block">
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
                    className="group relative border-t transition-colors duration-100 hover:bg-accent/40 focus-within:bg-accent/40"
                  >
                    <td className={tableStyles.td}>
                      {/* A stretched link makes the whole row a target without nesting links. */}
                      <Link
                        className="font-medium text-foreground underline-offset-2 after:absolute after:inset-0 group-hover:underline"
                        href={`/projects/${project.id}`}
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className={tableStyles.td}>
                      <ProjectStatusLabel status={project.status} />
                    </td>
                    <td className={tableStyles.td}>
                      {project.dealId === null ? (
                        <span className="text-meta text-muted-foreground">{S.noDeal}</span>
                      ) : (
                        <Link
                          className="relative z-10 text-foreground hover:underline"
                          href={`/deals/${project.dealId}`}
                        >
                          {project.dealTitle ?? project.dealId}
                        </Link>
                      )}
                    </td>
                    <td className={tableStyles.td}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={project.ownerName} className="size-5 shrink-0 text-caption" />
                        <span className="truncate">{project.ownerName}</span>
                      </span>
                    </td>
                    <td className={tableStyles.td}>
                      <ProjectProgress done={project.doneCount} total={project.taskCount} />
                    </td>
                    <td className={tableStyles.td}>
                      {project.dueDate === null || project.dueDate === "" ? (
                        <EmptyCell />
                      ) : (
                        <ProjectDueDate value={project.dueDate} now={now} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
