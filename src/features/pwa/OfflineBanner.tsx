"use client";
import type React from "react";
import { useSyncExternalStore } from "react";

const MESSAGE = "You're offline. Changes can't be saved until you reconnect.";

function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

// Server and initial client render both assume online, so the banner only appears after a real
// offline event instead of flashing during hydration.
const getServerSnapshot = (): boolean => true;

export function OfflineBanner(): React.ReactNode {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="flex items-center justify-center border-b bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
    >
      {MESSAGE}
    </div>
  );
}
