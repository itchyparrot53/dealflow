"use client";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Tip } from "@/components/ui/tooltip";
import { changeStageAction } from "@/features/deal-workspace/actions";
import { useDealActionError } from "@/features/deal-workspace/DealActionErrorProvider";
import { pushStageUndo } from "@/features/feedback/undo";
import { cn } from "@/lib/utils";
import { readCsrfToken } from "@/utils/csrfCookie";

export interface StageTrackChip {
  id: string;
  name: string;
  current: boolean;
  passed: boolean;
  days: number;
}

// Pipedrive's 24 px day-count track (6.8.2): equal-width chevron segments joined with a 2 px gap.
// Passed and current segments are green with white day counts; future segments are the track grey
// with secondary text. Each segment's tooltip names the stage; clicking one keeps the existing
// stage-change behaviour (append to the target column, undoable, error surfaced).
const FIRST_CLIP = "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)";
const MIDDLE_CLIP =
  "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)";
const LAST_CLIP = "polygon(0 0, 100% 0, 100% 100%, 0 100%, 8px 50%)";

function stateOf(chip: StageTrackChip): "passed" | "current" | "future" {
  if (chip.current) return "current";
  if (chip.passed) return "passed";
  return "future";
}

export function StageTrack({
  dealId,
  expectedUpdatedAt,
  chips,
}: {
  dealId: string;
  // CAS precondition: the deal's updatedAt ISO string.
  expectedUpdatedAt: string;
  chips: StageTrackChip[];
}): React.ReactNode {
  const router = useRouter();
  const reportError = useDealActionError();
  const [pending, setPending] = useState(false);

  async function select(chip: StageTrackChip): Promise<void> {
    if (chip.current || pending) return;
    setPending(true);
    const result = await changeStageAction(
      { dealId, toStageId: chip.id, expectedUpdatedAt },
      readCsrfToken(),
    );
    setPending(false);
    if (result.ok) {
      const from = chips.find((entry) => entry.current);
      if (from !== undefined) {
        pushStageUndo({
          dealId,
          fromStageId: from.id,
          toStageName: chip.name,
          updatedAt: result.deal.updatedAt,
          onUndone: () => router.refresh(),
        });
      }
      router.refresh();
    } else {
      reportError(result.error.id);
    }
  }

  return (
    <div
      data-testid="stage-track"
      role="listbox"
      aria-label="Stage"
      className="flex h-6 w-full items-stretch gap-0.5"
    >
      {chips.map((chip, index) => {
        const state = stateOf(chip);
        const first = index === 0;
        const last = index === chips.length - 1;
        const single = chips.length === 1;
        return (
          <Tip key={chip.id} label={chip.name}>
            <button
              type="button"
              role="option"
              aria-selected={chip.current}
              aria-current={chip.current ? "step" : undefined}
              aria-label={`${chip.name}, ${chip.days} ${chip.days === 1 ? "day" : "days"}`}
              data-state={state}
              disabled={pending}
              onClick={() => void select(chip)}
              style={{
                clipPath: single ? undefined : first ? FIRST_CLIP : last ? LAST_CLIP : MIDDLE_CLIP,
              }}
              className={cn(
                "flex h-6 min-w-0 flex-1 basis-0 items-center justify-center overflow-hidden text-meta transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-70",
                first && "rounded-l-md",
                last && "rounded-r-md",
                state === "future"
                  ? "bg-track text-track-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              <span className="truncate px-2">
                {chip.days} {chip.days === 1 ? "day" : "days"}
              </span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
