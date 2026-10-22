import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type React from "react";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { db } from "@/db/client";
import { listAssignableUsers } from "@/features/identity/users.service";
import {
  listProjectDealOptions,
  listProjects,
  projectStatusSchema,
} from "@/features/projects/projects";
import type { ProjectFilter } from "@/features/projects/types";
import { ProjectsList } from "@/features/projects/ui/ProjectsList";
import { createContext } from "@/server/trpc/context";

const S = PROJECTS_API_STRINGS.projects;

export const metadata: Metadata = { title: S.title };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /projects: the visible project list with the three filters (status, owner, search). Filters live
// in the URL so a reload or a shared link keeps them.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ownerId?: string; search?: string }>;
}): Promise<React.ReactNode> {
  const { actor } = await createContext();
  if (actor === null) redirect("/login");

  const params = await searchParams;
  const filter: ProjectFilter = {};
  const status = projectStatusSchema.safeParse(params.status);
  if (status.success) filter.status = status.data;
  if (params.ownerId !== undefined && UUID.test(params.ownerId)) filter.ownerId = params.ownerId;
  if (params.search !== undefined && params.search.trim() !== "") {
    filter.search = params.search.trim();
  }

  const signal = AbortSignal.timeout(10_000);
  const [projects, users, dealOptions] = await Promise.all([
    listProjects(db, actor, filter, signal),
    listAssignableUsers(db, signal),
    listProjectDealOptions(db, actor, signal),
  ]);

  return (
    <main aria-label={S.title} className="space-y-4 p-4">
      <h1 className="text-title">{S.title}</h1>
      <ProjectsList
        projects={projects}
        users={users}
        dealOptions={dealOptions}
        filters={{ status: params.status, ownerId: params.ownerId, search: params.search }}
      />
    </main>
  );
}
