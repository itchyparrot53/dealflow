import { create } from "zustand";
import { TOAST_MAX, TOAST_UNDO_MS } from "@/constants/productivity";
import type { Result } from "@/types/result";

// The toast store (6.5). Timers live outside the Zustand state so a re-render never restarts
// them; pause clears the timer and resumes with whatever time was left, which is what keeps an
// undo reachable while the pointer hovers the toast.

export interface ToastAction {
  label: string;
  run: () => Promise<Result<unknown, unknown>>;
}

export interface ToastItem {
  id: string;
  message: string;
  action?: ToastAction;
  durationMs: number;
  paused: boolean;
}

export interface ToastInput {
  message: string;
  action?: ToastAction;
  durationMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  // Runs the action at most once; a second click on the same toast is ignored.
  runAction: (id: string) => Promise<void>;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const deadlines = new Map<string, number>();
const ran = new Set<string>();
let nextId = 0;

function clearTimer(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  deadlines.delete(id);
}

export const useToastStore = create<ToastState>((set, get) => {
  const schedule = (id: string, ms: number): void => {
    clearTimer(id);
    deadlines.set(id, Date.now() + ms);
    timers.set(
      id,
      setTimeout(() => {
        clearTimer(id);
        get().dismiss(id);
      }, ms),
    );
  };

  const dismiss = (id: string): void => {
    clearTimer(id);
    ran.delete(id);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  };

  return {
    toasts: [],
    push: (input) => {
      const id = `toast-${String(++nextId)}`;
      const durationMs = input.durationMs ?? TOAST_UNDO_MS;
      set((state) => {
        const toasts = [
          ...state.toasts,
          { id, message: input.message, action: input.action, durationMs, paused: false },
        ];
        while (toasts.length > TOAST_MAX) {
          const dropped = toasts.shift();
          if (dropped !== undefined) clearTimer(dropped.id);
        }
        return { toasts };
      });
      schedule(id, durationMs);
      return id;
    },
    dismiss,
    pause: (id) => {
      const timer = timers.get(id);
      const deadline = deadlines.get(id);
      if (timer === undefined || deadline === undefined) return;
      clearTimeout(timer);
      timers.delete(id);
      deadlines.delete(id);
      const remaining = Math.max(0, deadline - Date.now());
      set((state) => ({
        toasts: state.toasts.map((toast) =>
          toast.id === id ? { ...toast, paused: true, durationMs: remaining } : toast,
        ),
      }));
    },
    resume: (id) => {
      const toast = get().toasts.find((entry) => entry.id === id);
      if (toast === undefined || !toast.paused) return;
      set((state) => ({
        toasts: state.toasts.map((entry) =>
          entry.id === id ? { ...entry, paused: false } : entry,
        ),
      }));
      schedule(id, toast.durationMs);
    },
    runAction: async (id) => {
      const toast = get().toasts.find((entry) => entry.id === id);
      if (toast?.action === undefined || ran.has(id)) return;
      ran.add(id);
      await toast.action.run();
    },
  };
});
