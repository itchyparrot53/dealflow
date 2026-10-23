import { FolderKanban } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { EmptyState } from "@/components/ui/EmptyState";

// A deleted or invisible project lands here instead of the app-level 404, whose only exit is
// "Back to pipeline" and loses the project context.
export default function ProjectNotFound(): React.ReactNode {
  return (
    <main className="space-y-4 p-4">
      <PageTitle title="Projects" />
      {/* A server component cannot call the client module's buttonVariants; this link carries
          the same primary tokens as Button. */}
      <EmptyState
        icon={<FolderKanban aria-hidden="true" />}
        title="Project not found."
        body="It may have been deleted, or you may no longer have access."
        action={
          <Link
            href="/projects"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors duration-100 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to projects
          </Link>
        }
        className="py-10"
      />
    </main>
  );
}
