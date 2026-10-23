"use client";
import type React from "react";
import { useSyncExternalStore } from "react";
import { clientEnv } from "@/config/clientEnv";

const MESSAGE = "You're offline. Changes can't be saved until you reconnect.";

// navigator.onLine is the source of truth, but the online/offline events are what tell an open tab
// that it changed (and some embedded/webview browsers update the event before the property). The
// last event therefore wins over a stale property value.
let override: boolean | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    }
  };
}

function onOnline(): void {
  override = true;
  notify();
}

function onOffline(): void {
  override = false;
  notify();
}

function getSnapshot(): boolean {
  if (typeof navigator === "undefined") return true;
  return override ?? navigator.onLine;
}

// The server and the first client render both assume online, so the banner never flashes during
// hydration; an actual offline state appears from the next snapshot.
const getServerSnapshot = (): boolean => true;

export function OfflineBanner(): React.ReactNode {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // 6.4: the banner is a user-facing mention of offline mode, so the flag hides it. The offline
  // store and the /offline fallback page keep working.
  if (!clientEnv.PWA_UI) return null;
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
