"use client";
import { useToastStore } from "@/features/feedback/toastStore";
import { ok } from "@/types/result";

// Remembers the worker we already announced so a repeated statechange or a second update check
// cannot stack identical toasts.
let announced: ServiceWorker | null = null;

export function showUpdatePrompt(worker: ServiceWorker): void {
  if (announced === worker) return;
  announced = worker;
  // An hour rather than the 8s undo window: deciding to reload is not time-critical, and the
  // toast must not vanish before the user has read it.
  useToastStore.getState().push({
    message: "New version available",
    testId: "update-available",
    durationMs: 60 * 60 * 1000,
    action: {
      label: "Reload",
      testId: "update-reload",
      run: () => {
        // Reload only once the waiting worker has taken control, so the old page is never
        // reloaded into the same old bundle.
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => window.location.reload(),
          { once: true },
        );
        worker.postMessage({ type: "SKIP_WAITING" });
        return Promise.resolve(ok(null));
      },
    },
  });
}

// A first install has no controller yet; announcing it as a "new version" would be wrong.
export function watchForUpdates(registration: ServiceWorkerRegistration): void {
  const announceWaiting = (): void => {
    if (registration.waiting !== null) showUpdatePrompt(registration.waiting);
  };
  announceWaiting();
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (installing === null) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
        showUpdatePrompt(installing);
      }
    });
  });
}
