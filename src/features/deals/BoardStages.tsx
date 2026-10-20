"use client";
import type React from "react";
import { BoardColumn } from "./BoardColumn";
import type { BoardProps } from "./boardTypes";
import type { BoardCard } from "./dealRepo";
import type { StageTotals } from "./useBoardDerived";

type Stage = BoardProps["stages"][number];

interface BoardStagesProps {
  stages: Stage[];
  sumsByStage: Map<string, StageTotals>;
  sortedByStage: Map<string, BoardCard[]>;
  density: BoardProps["density"];
  now: Date;
  pipelineId: string;
  pipelines: BoardProps["pipelines"];
  baseCurrency?: string;
}

// The horizontal list of stage columns. Extracted from Board so Board stays under the file-size
// cap; purely presentational (all board state is derived by the parent and passed in).
export function BoardStages({
  stages,
  sumsByStage,
  sortedByStage,
  density,
  now,
  pipelineId,
  pipelines,
  baseCurrency,
}: BoardStagesProps): React.ReactNode {
  return (
    <ul
      aria-label="Pipeline stages"
      className="flex min-h-0 flex-1 list-none gap-4 overflow-x-auto pb-4"
    >
      {stages.map((s, index) => {
        const stageSum = sumsByStage.get(s.id);
        const dividerBefore = index > 0;
        return (
          <li
            key={s.id}
            data-column-divider={dividerBefore ? "true" : undefined}
            className={[
              "relative flex min-w-72 flex-1",
              dividerBefore
                ? "before:absolute before:-left-2 before:inset-y-2 before:w-px before:bg-muted-foreground/25"
                : "",
            ]
              .join(" ")
              .trim()}
          >
            <BoardColumn
              stageId={s.id}
              stageName={s.name}
              order={s.order}
              rottingDays={s.rottingDays}
              cards={sortedByStage.get(s.id) ?? []}
              dealCount={stageSum?.dealCount ?? 0}
              totalValue={stageSum?.total ?? "0.00"}
              weightedValue={stageSum?.weighted ?? "0.00"}
              excludedCurrencies={stageSum?.excluded ?? []}
              density={density}
              now={now}
              pipelineId={pipelineId}
              pipelines={pipelines}
              baseCurrency={baseCurrency}
            />
          </li>
        );
      })}
    </ul>
  );
}
