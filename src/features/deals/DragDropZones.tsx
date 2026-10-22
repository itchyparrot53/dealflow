"use client";
import { useDroppable } from "@dnd-kit/core";
import type React from "react";
import type { DealStatus } from "@/constants/dealStatus";
import { cn } from "@/lib/utils";

// Pipedrive reveals a bottom action bar during a deal drag: Lost | Won | Move, each a 64 px dashed
// drop target. Colors stay restrained: lost cautionary, won positive, the rest neutral. Delete is
// deliberately NOT a drag target: deletion is a confirmed action on the deal's menu, not a drop
// zone, so the bar shows the three real targets rather than a fourth that does nothing.
export const DROP_ZONES = [
  { id: "deal-zone-lost", label: "Lost", tone: "bg-destructive/8 text-destructive" },
  { id: "deal-zone-won", label: "Won", tone: "bg-primary/8 text-primary" },
  { id: "deal-zone-move", label: "Move to", tone: "text-muted-foreground" },
] as const;

// Maps a drop-zone id to the deal status transition it triggers, or null for zones that are
// not a status change (Delete, Move/Convert) and for any non-zone target (a stage id).
export function zoneToStatus(zoneId: string): "won" | "lost" | null {
  if (zoneId === "deal-zone-won") return "won";
  if (zoneId === "deal-zone-lost") return "lost";
  return null;
}

export function zoneTransition(
  zoneId: string,
  currentStatus: DealStatus | undefined,
): "won" | "lost" | null {
  const target = zoneToStatus(zoneId);
  return target === currentStatus ? null : target;
}

function Zone({ id, label, tone }: { id: string; label: string; tone: string }): React.ReactNode {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-drop-zone={id}
      className={cn(
        // Pipedrive's drag action labels are upper case, like the status badges.
        "flex h-16 flex-1 items-center justify-center rounded-md border border-dashed text-meta font-semibold uppercase tracking-wide transition-colors duration-100", // design-ok: Pipedrive's drag labels are upper case
        tone,
        isOver ? "border-solid border-info bg-info-soft" : "border-border-strong",
      )}
    >
      {label}
    </div>
  );
}

export function DragDropZones({ active }: { active: boolean }): React.ReactNode {
  if (!active) return null;
  return (
    <section
      aria-label="Deal drop actions"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-card px-4 py-2"
    >
      {DROP_ZONES.map((z) => (
        <Zone key={z.id} id={z.id} label={z.label} tone={z.tone} />
      ))}
    </section>
  );
}
