"use client";
import { Archive, Kanban, List, Pencil, Pin, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { Tip } from "@/components/ui/tooltip";
import { ViewSwitcher } from "@/components/ui/view-switcher";
import { cn } from "@/lib/utils";
import { BoardActionsMenu } from "./BoardActionsMenu";
import { BoardSummary } from "./BoardSummary";
import { PipelineSelect } from "./PipelineSelect";

export type BoardToolbarView = "board" | "list" | "forecast" | "archived";

export interface BoardToolbarProps {
  pipelineId: string;
  pipelines: Array<{ id: string; name: string }>;
  totalValue: string;
  dealCount: number;
  activeView?: BoardToolbarView;
  presence?: React.ReactNode;
  createSlot?: React.ReactNode;
  exportSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  sortSlot?: React.ReactNode;
  quickFilters?: React.ReactNode;
  canManagePipelines?: boolean;
  baseCurrency?: string;
}

// Pipedrive's board header: a 64 px toolbar row (view switcher, split add button, count, pipeline
// menu and filter at right) over a 40 px filter row (Pin filters left, sort right).
export function BoardToolbar(props: BoardToolbarProps): React.ReactNode {
  const {
    pipelineId,
    pipelines,
    totalValue,
    dealCount,
    activeView = "board",
    baseCurrency,
  } = props;
  const {
    presence,
    createSlot,
    exportSlot,
    filterSlot,
    sortSlot,
    quickFilters,
    canManagePipelines,
  } = props;
  const router = useRouter();
  const [pinned, setPinned] = useState(false);

  const views = [
    {
      value: "board",
      label: "Board view",
      icon: <Kanban aria-hidden="true" />,
      href: `/pipeline/${pipelineId}`,
    },
    {
      value: "list",
      label: "List view",
      icon: <List aria-hidden="true" />,
      href: `/pipeline/${pipelineId}/list`,
    },
    {
      value: "forecast",
      label: "Forecast view",
      icon: <TrendingUp aria-hidden="true" />,
      href: "/forecast",
    },
    {
      value: "archived",
      label: "Archive view",
      icon: <Archive aria-hidden="true" />,
      href: `/pipeline/${pipelineId}/archived`,
    },
  ];

  return (
    <div className="flex flex-col">
      <PageToolbar
        left={
          <ViewSwitcher
            options={views}
            value={activeView}
            onChange={(next) => {
              const target = views.find((view) => view.value === next);
              if (target !== undefined) router.push(target.href);
            }}
          />
        }
        primary={
          <>
            {createSlot}
            {exportSlot}
          </>
        }
        right={
          <>
            <BoardSummary totalValue={totalValue} dealCount={dealCount} currency={baseCurrency} />
            <div className="inline-flex items-center">
              <PipelineSelect
                pipelineId={pipelineId}
                pipelines={pipelines}
                canManagePipelines={canManagePipelines}
              />
              <Link
                href={`/pipeline/${pipelineId}/edit`}
                aria-label="Edit pipeline"
                className="-ml-px flex size-8 items-center justify-center rounded-r-md border border-border-strong bg-card text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Link>
            </div>
            {filterSlot}
            <BoardActionsMenu pipelineId={pipelineId} />
            {presence}
          </>
        }
      />

      <div
        className={cn(
          "flex h-10 flex-wrap items-center gap-3",
          pinned && "sticky top-0 z-20 bg-background",
        )}
      >
        <Tip label="Keep the filter row above the board while you scroll">
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => setPinned((value) => !value)}
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              pinned ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Pin aria-hidden="true" className="size-4" />
            Pin filters
          </button>
        </Tip>
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{quickFilters}</div>
        <div className="ml-auto flex items-center gap-2">{sortSlot}</div>
      </div>
    </div>
  );
}
