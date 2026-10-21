// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RowSelection } from "@/components/data-table/useRowSelection";

const { bulkActivityAction } = vi.hoisted(() => ({ bulkActivityAction: vi.fn() }));
vi.mock("./list/bulkActions", () => ({ bulkActivityAction }));
vi.mock("@/utils/csrfCookie", () => ({ readCsrfToken: () => "csrf" }));

const { invalidateDayLoad, invalidateListRows } = vi.hoisted(() => ({
  invalidateDayLoad: vi.fn(() => Promise.resolve()),
  invalidateListRows: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/trpc-client", () => ({
  trpc: {
    useUtils: () => ({
      activities: {
        dayLoad: { invalidate: invalidateDayLoad },
        listRows: { invalidate: invalidateListRows },
      },
    }),
  },
}));

import { useActivityBulkActions } from "./useActivityBulkActions";

// Default for every test that does not override the batch outcome.
bulkActivityAction.mockResolvedValue({ ok: true, value: { applied: 2, failed: [] } });

afterEach(() => {
  vi.clearAllMocks();
});

function makeSelection(ids: readonly string[]): RowSelection {
  const selected = new Set(ids);
  return {
    selected,
    count: selected.size,
    isSelected: (id) => selected.has(id),
    toggle: vi.fn((id: string) => {
      selected.add(id);
    }),
    toggleAll: vi.fn(),
    clear: vi.fn(() => selected.clear()),
    allSelected: () => false,
  };
}

function renderActions(ids: readonly string[]) {
  const { result } = renderHook(() => useActivityBulkActions(makeSelection(ids)));
  return { result };
}

describe("useActivityBulkActions", () => {
  it("sends one delete batch and refreshes the list once", async () => {
    const { result } = renderActions(["a1", "a2"]);
    await act(() => result.current.bulkDelete());
    expect(bulkActivityAction).toHaveBeenCalledTimes(1);
    expect(bulkActivityAction).toHaveBeenCalledWith({ kind: "delete", ids: ["a1", "a2"] }, "csrf");
    expect(invalidateListRows).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("invalidates the day load once for a whole successful bulk delete", async () => {
    const { result } = renderActions(["a1", "a2", "a3"]);
    await act(() => result.current.bulkDelete());
    expect(invalidateDayLoad).toHaveBeenCalledTimes(1);
  });

  it("leaves the day load alone when every delete is denied", async () => {
    bulkActivityAction.mockResolvedValueOnce({
      ok: false,
      error: {
        id: "E_BULK_002",
        failed: [
          { id: "a1", errorId: "E_PERM_001" },
          { id: "a2", errorId: "E_PERM_001" },
        ],
      },
    });
    const { result } = renderActions(["a1", "a2"]);
    await act(() => result.current.bulkDelete());
    expect(result.current.error).not.toBeNull();
    expect(invalidateDayLoad).not.toHaveBeenCalled();
    expect(invalidateListRows).not.toHaveBeenCalled();
    bulkActivityAction.mockResolvedValue({ ok: true, value: { applied: 2, failed: [] } });
  });

  it("still invalidates the day load when only some deletes succeed", async () => {
    bulkActivityAction.mockResolvedValueOnce({
      ok: false,
      error: { id: "E_BULK_002", failed: [{ id: "a1", errorId: "E_PERM_001" }] },
    });
    const { result } = renderActions(["a1", "a2"]);
    await act(() => result.current.bulkDelete());
    expect(invalidateDayLoad).toHaveBeenCalledTimes(1);
    bulkActivityAction.mockResolvedValue({ ok: true, value: { applied: 2, failed: [] } });
  });

  it("sends one mark-done batch and refreshes the list once", async () => {
    const { result } = renderActions(["a1", "a2"]);
    await act(() => result.current.bulkMarkDone());
    expect(bulkActivityAction).toHaveBeenCalledWith(
      { kind: "markDone", ids: ["a1", "a2"] },
      "csrf",
    );
    expect(invalidateListRows).toHaveBeenCalledTimes(1);
  });

  it("invalidates the day load once for a whole successful bulk mark-done", async () => {
    const { result } = renderActions(["a1", "a2"]);
    await act(() => result.current.bulkMarkDone());
    expect(invalidateDayLoad).toHaveBeenCalledTimes(1);
  });

  it("sends the reschedule date", async () => {
    const { result } = renderActions(["a1"]);
    await act(() => result.current.bulkReschedule("2026-07-20"));
    expect(bulkActivityAction).toHaveBeenCalledWith(
      { kind: "reschedule", ids: ["a1"], date: "2026-07-20" },
      "csrf",
    );
  });

  it("sends the new owner", async () => {
    const { result } = renderActions(["a1"]);
    await act(() => result.current.bulkChangeOwner("u2"));
    expect(bulkActivityAction).toHaveBeenCalledWith(
      { kind: "owner", ids: ["a1"], ownerId: "u2" },
      "csrf",
    );
  });

  it("does nothing when the selection is empty", async () => {
    const { result } = renderActions([]);
    await act(() => result.current.bulkDelete());
    expect(bulkActivityAction).not.toHaveBeenCalled();
    expect(invalidateListRows).not.toHaveBeenCalled();
    expect(invalidateDayLoad).not.toHaveBeenCalled();
  });
});
