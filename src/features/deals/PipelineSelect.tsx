"use client";
import { ChevronDown, Kanban, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STRINGS } from "@/constants/strings";
import { CreatePipelineDialog } from "@/features/pipelines/CreatePipelineDialog";
import { cn } from "@/lib/utils";

interface PipelineSelectProps {
  pipelineId: string;
  pipelines: Array<{ id: string; name: string }>;
  canManagePipelines?: boolean;
}

export function PipelineSelect(props: PipelineSelectProps): React.ReactNode {
  const { pipelineId, pipelines, canManagePipelines = false } = props;
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = pipelines.find((p) => p.id === pipelineId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-2 text-sm font-semibold text-foreground transition-colors duration-100 hover:bg-muted"
        >
          <Kanban aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="max-w-40 truncate">{current?.name ?? "Pipeline"}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" aria-label="Select pipeline" className="min-w-44">
          {pipelines.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => router.push(`/pipeline/${p.id}`)}
              className={cn("truncate", p.id === pipelineId && "font-semibold text-foreground")}
            >
              {p.name}
            </DropdownMenuItem>
          ))}
          {canManagePipelines && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                {STRINGS.settings.addNewPipeline}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreatePipelineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated="board"
        returnFocusTo={triggerRef}
      />
    </>
  );
}
