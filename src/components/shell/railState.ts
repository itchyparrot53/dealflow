// The rail's expanded/collapsed preference (PLAN-PART12.md 6.4). The cookie is read on the server
// by the app layout, so the first paint already has the right width and nothing shifts.

export const RAIL_COOKIE = "wd_rail";
// A single custom event keeps the keyboard shortcut (GlobalShortcuts) out of LeftNav's internals.
export const RAIL_TOGGLE_EVENT = "warpdrive:toggle-rail";

export type RailState = "expanded" | "collapsed";

// Missing, empty or unknown values all mean expanded: that is the default the owner asked for.
export function normalizeRailState(value: string | null | undefined): RailState {
  return value === "collapsed" ? "collapsed" : "expanded";
}

export function railStateToggle(state: RailState): RailState {
  return state === "expanded" ? "collapsed" : "expanded";
}

export function railCookie(state: RailState): string {
  return `${RAIL_COOKIE}=${state}; path=/; max-age=31536000; SameSite=Lax`;
}

export function writeRailState(state: RailState): void {
  if (typeof document === "undefined") return;
  document.cookie = railCookie(state);
}
