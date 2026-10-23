import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { db } from "@/db/client";
import { listAssignableUsers } from "@/features/identity/users.service";
import { getProject } from "@/features/projects/projects";
import { ProjectBoard } from "@/features/projects/ui/ProjectBoard";
import { canEditProject } from "@/features/projects/visibility";
import { isUuidParam } from "@/lib/isUuidParam";
import { createContext } from "@/server/trpc/context";

export const metadata: Metadata = { title: "Project" };

// /projects/{id}: the board. The service hides an invisible project as a 404, and the edit rule
// (owner, assignee or admin) only decides which controls render; every action re-checks it.
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  if (!isUuidParam(id)) notFound();

  const ctx = await createContext();
  if (ctx.actor === null) redirect("/login");

  const signal = AbortSignal.timeout(10_000);
  const [project, users] = await Promise.all([
    getProject(db, ctx.actor, id, signal),
    listAssignableUsers(db, signal),
  ]);
  if (!project.ok) notFound();

  const assigneeIds = project.value.tasks.flatMap((task) =>
    task.assigneeId === null ? [] : [task.assigneeId],
  );
  const canEdit = canEditProject(ctx.actor, project.value.ownerId, assigneeIds);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main aria-label={project.value.name} className="space-y-4 p-4">
      <PageTitle title="Projects" />
      <ProjectBoard project={project.value} users={users} canEdit={canEdit} today={today} />
    </main>
  );
}
