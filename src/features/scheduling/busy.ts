import { and, eq, isNull, lt } from "drizzle-orm";
import { BOOKING_DEFAULT_DURATION } from "@/constants/formsBooking";
import { activities } from "@/db/schema";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// Busy time is the host's open, timed activities. The span is `end_at` when set, else
// `due_at + duration_minutes`, else the default duration; all-day rows never block a slot.
// Assignee is the host: upstream `activities.assignee_id` is NOT NULL, so the "owner when the
// assignee is null" fallback in the plan has no column to read.

export interface BusyWindow {
  start: Date;
  end: Date;
}

export async function loadBusy(
  db: DbOrTx,
  hostId: string,
  fromUtc: Date,
  toUtc: Date,
  signal: AbortSignal,
): Promise<BusyWindow[]> {
  signal.throwIfAborted();
  const rows = await db
    .select({
      dueAt: activities.dueAt,
      endAt: activities.endAt,
      durationMinutes: activities.durationMinutes,
    })
    .from(activities)
    .where(
      and(
        eq(activities.assigneeId, hostId),
        eq(activities.done, false),
        isNull(activities.deletedAt),
        eq(activities.allDay, false),
        lt(activities.dueAt, toUtc),
      ),
    );
  signal.throwIfAborted();

  const windows: BusyWindow[] = [];
  for (const row of rows) {
    if (row.dueAt === null) continue;
    const end =
      row.endAt ??
      new Date(row.dueAt.getTime() + (row.durationMinutes ?? BOOKING_DEFAULT_DURATION) * 60_000);
    // Overlap is half-open: an activity ending exactly at the window start does not block it.
    if (end <= fromUtc) continue;
    windows.push({ start: row.dueAt, end });
  }
  return windows;
}
