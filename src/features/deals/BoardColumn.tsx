"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Tip } from "@/components/ui/tooltip";
import { useLabelColorResolver } from "@/features/labels/useLabelColorResolver";
import { formatCurrency } from "@/lib/formatCurrency";
import { DealCard } from "./DealCard";
import type { BoardCard } from "./dealRepo";
import { StageAddButton } from "./StageAddButton";
import { StageColumnMenu } from "./StageColumnMenu";

interface DraggableCardProps {
  card: BoardCard;
  rottingDays: number | null;
  density: "comfortable" | "compact";
  now: Date;
  baseCurrency?: string;
}

function DraggableCard(props: DraggableCardProps): React.ReactNode {
  const { card, rottingDays, density, now, baseCurrency } = props;
  const router = useRouter();
  const resolveLabels = useLabelColorResolver("deal");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { stageId: card.stageId, boardPosition: card.boardPosition },
  });

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : undefined }}>
      <DealCard
        dragProps={{ ...attributes, ...listeners }}
        card={card}
        ownerName={card.ownerName ?? "?"}
        ownerAvatarUrl={card.ownerAvatarUrl}
        personName={card.personName ?? null}
        orgName={card.orgName ?? null}
        labels={resolveLabels(card.labels)}
        rottingDays={rottingDays}
        density={density}
        now={now}
        baseCurrency={baseCurrency}
        onOpen={() => router.push(`/deals/${card.id}`)}
      />
    </div>
  );
}

export interface BoardColumnProps {
  stageId: string;
  stageName: string;
  order: number;
  rottingDays: number | null;
  cards: BoardCard[];
  dealCount: number;
  totalValue: string;
  weightedValue: string;
  excludedCount: number;
  excludedCurrencies: string[];
  density: "comfortable" | "compact";
  // null until the client clock is set (see Board). Threads down to each DealCard's time visuals.
  now: Date;
  // For the per-stage add-deal button (opens the modal preset to this stage).
  pipelineId: string;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
  baseCurrency?: string;
}

export function BoardColumn(props: BoardColumnProps): React.ReactNode {
  const {
    stageId,
    stageName,
    rottingDays,
    cards,
    dealCount,
    totalValue,
    weightedValue,
    excludedCount,
    excludedCurrencies,
    density,
    now,
  } = props;
  const { pipelineId, pipelines, baseCurrency } = props;
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  // P1: local collapse state, toggled from the per-column actions menu. Session-only (no persist):
  // a rep collapses a stage to focus the board for the current session, not as a durable preference.
  const [collapsed, setCollapsed] = useState(false);
  // 6.7.2: three lines that can never truncate at the seeded totals. Line 2 is the total and the
  // deal count; line 3 is the weighted total, with the excluded count appended when there is one.
  const totalLabel = formatCurrency(totalValue, baseCurrency);
  const weightedLine = `Weighted ${formatCurrency(weightedValue, baseCurrency)}${
    excludedCount > 0 ? ` · ${excludedCount} excluded` : ""
  }`;

  return (
    <section
      ref={setNodeRef}
      data-testid="board-column"
      aria-roledescription="stage column"
      aria-label={stageName}
      className={[
        // The measured column (6.8.1): 248 wide, canvas-subtle fill, radius 8, 8 px inner padding,
        // and the chevron right edge from globals.css. The first column is square on the left.
        "board-column flex h-full min-w-[248px] flex-col overflow-hidden rounded-tl-lg bg-canvas-subtle",
        collapsed ? "" : "min-h-0",
        isOver ? "bg-info-soft" : "",
      ]
        .join(" ")
        .trim()}
    >
      <header className="h-[72px] shrink-0 px-3 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {stageName}
          </h2>
          <StageColumnMenu
            pipelineId={pipelineId}
            stageId={stageId}
            stageName={stageName}
            pipelines={pipelines}
            baseCurrency={baseCurrency}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
          />
        </div>
        <Tip label={`${totalLabel} · ${dealCount} ${dealCount === 1 ? "deal" : "deals"}`}>
          <p
            data-testid="board-column-total"
            className="mt-0.5 truncate text-meta text-muted-foreground tabular"
          >
            {totalLabel} · {dealCount} {dealCount === 1 ? "deal" : "deals"}
          </p>
        </Tip>
        <Tip label={weightedLine}>
          <p
            data-testid="board-column-weighted"
            className="truncate text-meta text-muted-foreground tabular"
          >
            {weightedLine}
          </p>
        </Tip>
      </header>

      {!collapsed && (
        <>
          <ul
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2"
            aria-label={`${stageName} deals`}
          >
            {cards.map((card) => (
              <li
                key={card.id}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_80px]"
              >
                <DraggableCard
                  card={card}
                  rottingDays={rottingDays}
                  density={density}
                  now={now}
                  baseCurrency={baseCurrency}
                />
              </li>
            ))}
          </ul>

          <StageAddButton
            pipelineId={pipelineId}
            stageId={stageId}
            pipelines={pipelines}
            baseCurrency={baseCurrency}
          />
        </>
      )}
    </section>
  );
}
