"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DEAL_SIDEBAR_STRINGS } from "@/constants/dealSidebarStrings";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { CollapsibleSection } from "@/features/deal-workspace/CollapsibleSection";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createProjectFromDealAction } from "../actions";
import type { ProjectListItem, ProjectView } from "../types";

const S = PROJECTS_API_STRINGS.projects;

// The deal sidebar's Projects section. It reads through projects.list({ dealId }), so the list is
// visibility-filtered by the service exactly like the /projects page. "Create project" shows only
// on a won deal (6.6); the service re-checks the won status on the user path.

export function DealProjectsSection({
  dealId,
  dealWon,
  canEdit,
  projects,
}: {
  dealId: string;
  dealWon: boolean;
  canEdit: boolean;
  projects: ProjectListItem[];
}): React.ReactNode {
  const router = useRouter();
  const rows = projects;
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(): Promise<void> {
    setPending(true);
    setErrorId(null);
    const response = await createProjectFromDealAction(dealId, {}, readCsrfToken());
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    const created = response.value as ProjectView;
    router.push(`/projects/${created.id}`);
  }

  return (
    <CollapsibleSection title={DEAL_SIDEBAR_STRINGS.sections.projects} showFilter={false}>
      <div data-testid="deal-projects-section" className="space-y-2 px-3 pb-3">
        {errorId !== null && (
          <p role="alert" className="text-sm text-destructive">
            {projectsErrorMessage(errorId)}
          </p>
        )}
        {canEdit && dealWon && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="deal-create-project"
            disabled={pending}
            onClick={() => void create()}
          >
            {S.createFromDeal}
          </Button>
        )}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{S.noProjects}</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-2 text-sm">
                <Link className="truncate hover:underline" href={`/projects/${project.id}`}>
                  {project.name}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{S.statuses[project.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {S.task.progress(project.doneCount, project.taskCount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleSection>
  );
}
