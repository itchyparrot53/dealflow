"use client";
import { deleteAllOfflineData } from "./db";

export const OFFLINE_USER_KEY = "dealflow-offline-user";

export type WipeDecision = "keep" | "record" | "wipe";

// The whole user-change rule as a pure function, so it is testable without IndexedDB:
// - no previous user: just remember the current one (a fresh browser has nothing to wipe);
// - the same user: keep everything;
// - a different user, or a sign-out: wipe first.
export function decideWipe(previous: string | null, current: string | null): WipeDecision {
  if (previous === null) return current === null ? "keep" : "record";
  if (current === null) return "wipe";
  return previous === current ? "keep" : "wipe";
}

export function readOfflineUserId(): string | null {
  try {
    return localStorage.getItem(OFFLINE_USER_KEY);
  } catch {
    return null;
  }
}

function writeOfflineUserId(userId: string | null): void {
  try {
    if (userId === null) localStorage.removeItem(OFFLINE_USER_KEY);
    else localStorage.setItem(OFFLINE_USER_KEY, userId);
  } catch {
    // Blocked storage disables offline mode; it must not break the page.
  }
}

export async function syncOfflineUser(currentUserId: string | null): Promise<void> {
  const previous = readOfflineUserId();
  const decision = decideWipe(previous, currentUserId);
  if (decision === "wipe") await deleteAllOfflineData(previous);
  if (decision !== "keep") writeOfflineUserId(currentUserId);
}

// Sign-out is a plain GET (/auth/logout); wiping on the client first keeps the records of the
// person who just left out of reach of the next person to open this browser profile.
export async function wipeAndSignOut(): Promise<void> {
  const previous = readOfflineUserId();
  await deleteAllOfflineData(previous);
  writeOfflineUserId(null);
  window.location.assign("/auth/logout");
}
