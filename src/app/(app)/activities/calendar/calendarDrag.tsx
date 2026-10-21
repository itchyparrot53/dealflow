"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type React from "react";
import { useCallback, useState } from "react";
import { editActivityAction } from "@/features/activities/actions";
import type { CalendarActivity } from "@/features/activities/calendar";
import { useToastStore } from "@/features/feedback/toastStore";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";

// Calendar drag to reschedule (6.6). A week drop carries the target day and hour, so a timed event
// moves between days and times; a month drop carries the day only, keeping the time of day. The
// activity update service runs on drop, and the calendar queries are refetched only after it
// succeeds (a failed write leaves the calendar as it was and surfaces the error).

export interface CalendarDropTarget {
  date: string;
  hour?: number;
}

interface DragData {
  activity: CalendarActivity;
}

// The new due instant for a drop: an all-day item lands on local midnight of the day it was
// dropped on; a timed item keeps its minutes but takes the dropped hour.
export function rescheduledIso(activity: CalendarActivity, target: CalendarDropTarget): string {
  const [year, month, day] = target.date.split("-").map(Number);
  const hour = activity.allDay || target.hour === undefined ? 0 : target.hour;
  const minute = activity.allDay || target.hour === undefined ? 0 : activity.dueAt.getMinutes();
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour, minute).toISOString();
}

export function CalendarDrag({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop: (activity: CalendarActivity, target: CalendarDropTarget) => void;
}): React.ReactNode {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [active, setActive] = useState<CalendarActivity | null>(null);

  function start(event: DragStartEvent): void {
    const data = event.active.data.current as DragData | undefined;
    setActive(data?.activity ?? null);
  }

  function end(event: DragEndEvent): void {
    setActive(null);
    const data = event.active.data.current as DragData | undefined;
    const target = event.over?.data.current as CalendarDropTarget | undefined;
    if (data?.activity !== undefined && target !== undefined) onDrop(data.activity, target);
  }

  return (
    <DndContext sensors={sensors} onDragStart={start} onDragEnd={end}>
      {children}
      <DragOverlay>
        {active === null ? null : (
          <div className="rounded-md border bg-card px-2 py-1 text-xs shadow-md">
            {active.subject}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export function DraggableActivity({
  activity,
  children,
}: {
  activity: CalendarActivity;
  children: React.ReactNode;
}): React.ReactNode {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: { activity } satisfies DragData,
  });
  // Only the pointer listeners go on the wrapper: dnd-kit's `attributes` set role="button" on it,
  // which made every chip expose two identically named buttons (the wrapper and the chip itself).
  // Keyboard dragging is not offered; the chip keeps its own keyboard activation.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{
        transform: transform === null ? undefined : CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {children}
    </div>
  );
}

export function useCalendarDrop(target: CalendarDropTarget): {
  setNodeRef: (node: HTMLElement | null) => void;
  isOver: boolean;
} {
  const { setNodeRef, isOver } = useDroppable({
    id: `${target.date}-${String(target.hour ?? "day")}`,
    data: target,
  });
  return { setNodeRef, isOver };
}

// The drop handler both grids share. It keeps the optimistic behaviour at the grid level: the
// refetch happens after the write succeeds, so a refused write never leaves a moved chip.
export function useRescheduleActivity(): {
  reschedule: (activity: CalendarActivity, target: CalendarDropTarget) => Promise<void>;
} {
  const utils = trpc.useUtils();

  const reschedule = useCallback(
    async (activity: CalendarActivity, target: CalendarDropTarget) => {
      const dueAt = rescheduledIso(activity, target);
      if (dueAt === activity.dueAt.toISOString()) return;
      const result = await editActivityAction(
        { id: activity.id, dueAt, allDay: activity.allDay },
        readCsrfToken(),
      );
      if (!result.ok) {
        useToastStore.getState().push({
          message: `Could not reschedule the activity (${result.error.id})`,
          tone: "error",
        });
        return;
      }
      await Promise.all([
        utils.activities.calendarRange.invalidate(),
        utils.activities.listForEntity.invalidate(),
        utils.activities.listRows.invalidate(),
      ]);
    },
    [utils],
  );

  return { reschedule };
}
