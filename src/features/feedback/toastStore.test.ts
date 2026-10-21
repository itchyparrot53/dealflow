import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOAST_UNDO_MS } from "@/constants/productivity";
import { ok } from "@/types/result";
import { useToastStore } from "./toastStore";

function clearToasts(): void {
  for (const toast of useToastStore.getState().toasts) {
    useToastStore.getState().dismiss(toast.id);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  clearToasts();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("toast store", () => {
  test("caps visible toasts at three and drops the oldest", () => {
    const store = useToastStore.getState();
    store.push({ message: "one" });
    store.push({ message: "two" });
    store.push({ message: "three" });
    store.push({ message: "four" });
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([
      "two",
      "three",
      "four",
    ]);
  });

  test("dismisses a toast after the default duration", () => {
    useToastStore.getState().push({ message: "saved" });
    vi.advanceTimersByTime(TOAST_UNDO_MS - 1);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  test("runs an action once and ignores a second click", async () => {
    const run = vi.fn(() => Promise.resolve(ok(null)));
    const id = useToastStore.getState().push({
      message: "Moved to Won",
      action: { label: "Undo", run },
    });
    await useToastStore.getState().runAction(id);
    await useToastStore.getState().runAction(id);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("pause holds the timer and resume restarts the remaining time", () => {
    const id = useToastStore.getState().push({ message: "Undo", durationMs: 1_000 });
    vi.advanceTimersByTime(400);
    useToastStore.getState().pause(id);
    vi.advanceTimersByTime(5_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]?.paused).toBe(true);

    useToastStore.getState().resume(id);
    vi.advanceTimersByTime(599);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  test("dismiss removes a toast immediately", () => {
    const id = useToastStore.getState().push({ message: "Undo" });
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
