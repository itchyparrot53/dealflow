"use client";
import type React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { funnelClip } from "./boardStageHeader";

interface StageChevronProps {
  stages: Array<{ id: string; name: string }>;
  selectedId: string;
  onSelect: (stageId: string) => void;
}

// Pipedrive's stage picker in the Add deal dialog (PLAN-PART12.md 6.7.1): one text-free chevron
// segment per stage, the selected stage and the ones before it in the primary colour, later ones
// on the track colour. Each segment is a radio with the stage name as its accessible name and a
// tooltip; the selected stage is named under the track with "Stage n of total". Radix's RadioGroup
// gives arrow-key roving for free.
export function StageChevron({ stages, selectedId, onSelect }: StageChevronProps): React.ReactNode {
  const selectedIndex = stages.findIndex((stage) => stage.id === selectedId);
  const current = selectedIndex === -1 ? 0 : selectedIndex;
  const selected = stages[current];

  // Radix moves focus between radios with the arrow keys; making the selection follow the same
  // keys is this picker's own behaviour (6.7.1), so it is explicit rather than incidental.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0 || stages.length === 0) return;
    event.preventDefault();
    const next = stages[(current + delta + stages.length) % stages.length];
    if (next !== undefined) onSelect(next.id);
  }

  return (
    <div className="space-y-1.5">
      <RadioGroup
        value={selectedId}
        onValueChange={onSelect}
        onKeyDown={onKeyDown}
        aria-label="Pipeline stage"
        className="flex w-full gap-0.5"
      >
        {stages.map((stage, index) => (
          <Tip key={stage.id} label={stage.name}>
            <RadioGroupItem
              value={stage.id}
              aria-label={stage.name}
              style={{
                clipPath: funnelClip(index === 0),
                backgroundColor: index <= current ? "hsl(var(--primary))" : "hsl(var(--track))",
              }}
              className={cn(
                "h-6 min-w-0 flex-1 rounded-none border-0 transition-opacity hover:opacity-90",
                index === current ? "opacity-100" : "opacity-90",
              )}
            >
              <span className="sr-only">{stage.name}</span>
            </RadioGroupItem>
          </Tip>
        ))}
      </RadioGroup>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{selected?.name ?? ""}</span>
        <span className="text-meta text-muted-foreground">
          Stage {current + 1} of {stages.length}
        </span>
      </div>
    </div>
  );
}
