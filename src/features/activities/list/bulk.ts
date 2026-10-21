// Pure helpers for the Activities bulk bar (1.4). Rescheduling keeps each activity's local time of
// day and only moves its date, computed in the assignee's zone (never the server's).

import { utcToZoned, zonedToUtc } from "@/features/scheduling/zonedTime";

export function rescheduledIso(
  dueAtIso: string | null,
  date: string,
  allDay: boolean,
  tz: string,
): string {
  const time = allDay || dueAtIso === null ? "00:00" : utcToZoned(new Date(dueAtIso), tz).time;
  return zonedToUtc(date, time, tz).toISOString();
}
