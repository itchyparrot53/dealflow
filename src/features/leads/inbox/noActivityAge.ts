// "No activity" is neutral until it has been true for two weeks. The clock is the later of the
// lead's creation and its last completed activity, both already on the row, so the warning needs
// no new field or query.

export const NO_ACTIVITY_WARNING_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NoActivityAge {
  createdAt: Date | string;
  lastActivityAt: Date | string | null | undefined;
}

export function isStaleWithoutActivity(row: NoActivityAge, now: Date): boolean {
  const since = row.lastActivityAt ?? row.createdAt;
  const at = typeof since === "string" ? new Date(since) : since;
  const time = at.getTime();
  if (!Number.isFinite(time)) return false;
  return now.getTime() - time >= NO_ACTIVITY_WARNING_DAYS * DAY_MS;
}
