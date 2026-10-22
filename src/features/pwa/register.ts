"use client";
import { useEffect } from "react";
import { startInstallPromptCapture } from "./installPrompt";
import { watchForUpdates } from "./UpdatePrompt";

// Mounted once in the authenticated shell. In development any worker is unregistered so a stale
// bundle can never be served locally; in a production build /sw.js is registered at scope /. The
// server layout passes `production` because the env boundary may only be read on the server.
export function ServiceWorkerRegistration({ production }: { production: boolean }): null {
  useEffect(() => {
    startInstallPromptCapture();
    if (!("serviceWorker" in navigator)) return undefined;

    if (!production) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((entry) => entry.unregister())))
        .catch(() => undefined);
      return undefined;
    }

    let cancelled = false;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(
      (registration) => {
        if (cancelled) return;
        watchForUpdates(registration);
        // Catch a deploy that landed while this tab stayed open.
        void registration.update().catch(() => undefined);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [production]);
  return null;
}
