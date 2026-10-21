import { describe, expect, test } from "vitest";
import { trimToNewest } from "./trim";

type Record = { id: string; savedAt: string; title: string };

function record(id: string, savedAt: string, title = id): Record {
  return { id, savedAt, title };
}

describe("trimToNewest", () => {
  test("keeps the newest 50 and drops the oldest", () => {
    const records = Array.from({ length: 60 }, (_, i) =>
      record(`deal-${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()),
    );
    const kept = trimToNewest(records, 50);
    expect(kept).toHaveLength(50);
    expect(kept[0]?.id).toBe("deal-59");
    expect(kept[49]?.id).toBe("deal-10");
    expect(kept.some((r) => r.id === "deal-9")).toBe(false);
  });

  test("a re-saved id replaces the old copy", () => {
    const kept = trimToNewest(
      [
        record("deal-1", "2026-01-01T00:00:00.000Z", "old title"),
        record("deal-2", "2026-01-02T00:00:00.000Z"),
        record("deal-1", "2026-01-03T00:00:00.000Z", "new title"),
      ],
      50,
    );
    expect(kept).toHaveLength(2);
    expect(kept[0]).toEqual(record("deal-1", "2026-01-03T00:00:00.000Z", "new title"));
    expect(kept[1]?.id).toBe("deal-2");
  });

  test("keeps everything when there is room", () => {
    const kept = trimToNewest(
      [
        record("a", "2026-01-01T00:00:00.000Z"),
        record("b", "2026-01-03T00:00:00.000Z"),
        record("c", "2026-01-02T00:00:00.000Z"),
      ],
      50,
    );
    expect(kept.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  test("a non-positive keep yields nothing", () => {
    expect(trimToNewest([record("a", "2026-01-01T00:00:00.000Z")], 0)).toEqual([]);
    expect(trimToNewest([record("a", "2026-01-01T00:00:00.000Z")], -1)).toEqual([]);
  });

  test("does not mutate its input", () => {
    const records = [
      record("a", "2026-01-01T00:00:00.000Z"),
      record("b", "2026-01-02T00:00:00.000Z"),
    ];
    trimToNewest(records, 1);
    expect(records.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
