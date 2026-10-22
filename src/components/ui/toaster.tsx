"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/features/feedback/toastStore";

// The single toast region (6.8): bottom-centre on mobile, bottom-right on desktop. Each toast can
// be dismissed with Escape (when focused) or its X, and hovering or focusing it pauses its timer so
// an Undo stays reachable. Errors announce assertively, confirmations politely.
export function Toaster(): React.ReactNode {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const pause = useToastStore((state) => state.pause);
  const resume = useToastStore((state) => state.resume);
  const runAction = useToastStore((state) => state.runAction);

  return (
    <section
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col-reverse items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid={toast.testId ?? "toast"}
          role="status"
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          onMouseEnter={() => pause(toast.id)}
          onMouseLeave={() => resume(toast.id)}
          onFocus={() => pause(toast.id)}
          onBlur={() => resume(toast.id)}
          onKeyDown={(event) => {
            if (event.key === "Escape") dismiss(toast.id);
          }}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-lg"
        >
          <p
            className={
              toast.tone === "error"
                ? "min-w-0 flex-1 text-sm text-destructive"
                : "min-w-0 flex-1 text-sm text-foreground"
            }
          >
            {toast.message}
          </p>
          {toast.action !== undefined && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid={toast.action.testId ?? "toast-undo"}
              onClick={() => void runAction(toast.id)}
            >
              {toast.action.label}
            </Button>
          )}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(toast.id)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </section>
  );
}
