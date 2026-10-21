// Pure helpers for the Activities bulk bar (1.4). Rescheduling keeps each activity's time of day
// and only moves its local date; an all-day activity lands on local midnight of the new day.

export function rescheduledIso(dueAtIso: string | null, date: string, allDay: boolean): string {
  const [year, month, day] = date.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return new Date().toISOString();
  }
  if (allDay || dueAtIso === null) {
    return new Date(year, month - 1, day).toISOString();
  }
  const current = new Date(dueAtIso);
  return new Date(year, month - 1, day, current.getHours(), current.getMinutes()).toISOString();
}
