// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadRow } from "../leadRepo";
import { LEAD_COLUMNS, type LeadColumn } from "./columns";

vi.mock("@/lib/trpc-client", () => ({
  trpc: { labels: { listByTarget: { useQuery: () => ({ data: [] }) } } },
}));

import { LeadCell } from "./LeadCell";

afterEach(cleanup);

function col(key: string): LeadColumn {
  const found = LEAD_COLUMNS.find((c) => c.key === key);
  if (found === undefined) throw new Error(`no such column: ${key}`);
  return found;
}

// Minimal row; the nextActivity column reads nextActivityAt plus the creation and last-activity
// timestamps for the neutral-versus-stale rule.
function row(
  nextActivityAt: string | null,
  over: Partial<Record<keyof LeadRow, unknown>> = {},
): LeadRow {
  return {
    id: "l1",
    title: "Lead",
    value: null,
    labels: [],
    sourceOrigin: "manually_created",
    personName: null,
    orgName: null,
    ownerName: null,
    nextActivityAt,
    lastActivityAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    convertedDealId: null,
    customFields: {},
    ...over,
  } as unknown as LeadRow;
}

describe("LeadCell nextActivity clock (F5-16)", () => {
  const overdue = "2020-01-01T00:00:00.000Z";

  it("renders a neutral (non-overdue) baseline when the clock is not yet set (null)", () => {
    // On the server render and the first client render `now` is null so SSR and hydration agree;
    // the time-based overdue color must NOT be applied yet (that is what caused the board's
    // hydration mismatch). It must render, not crash, with no destructive color.
    const { container } = render(
      <LeadCell column={col("nextActivity")} row={row(overdue)} now={null} currency="USD" />,
    );
    expect(container.querySelector(".text-destructive")).toBeNull();
    expect(container.textContent).not.toBe("");
  });

  it("applies the overdue color once the client clock is set", () => {
    const { container } = render(
      <LeadCell
        column={col("nextActivity")}
        row={row(overdue)}
        now={new Date("2026-06-01T00:00:00.000Z")}
        currency="USD"
      />,
    );
    expect(container.querySelector(".text-destructive")).not.toBeNull();
  });
});

describe("LeadCell no activity (U24)", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("renders the calm muted state with a CalendarX icon, not a warning badge", () => {
    const { container } = render(
      <LeadCell
        column={col("nextActivity")}
        row={row(null, { createdAt: "2026-05-31T00:00:00.000Z" })}
        now={now}
        currency="USD"
      />,
    );
    const cell = container.querySelector("span");
    expect(cell?.textContent).toBe("No activity");
    expect(cell?.className).toContain("text-muted-foreground");
    expect(cell?.className).not.toContain("warning");
    expect(container.querySelector("svg.lucide-calendar-x")).not.toBeNull();
  });

  it("warns only after 14 days without activity since creation", () => {
    const recent = render(
      <LeadCell
        column={col("nextActivity")}
        row={row(null, { createdAt: "2026-05-25T00:00:00.000Z" })}
        now={now}
        currency="USD"
      />,
    );
    expect(recent.container.querySelector(".text-warning-soft-foreground")).toBeNull();
    recent.unmount();

    const stale = render(
      <LeadCell
        column={col("nextActivity")}
        row={row(null, { createdAt: "2026-05-01T00:00:00.000Z" })}
        now={now}
        currency="USD"
      />,
    );
    expect(stale.container.querySelector(".text-warning-soft-foreground")).not.toBeNull();
  });

  it("measures the warning from the last activity when one is loaded", () => {
    const { container } = render(
      <LeadCell
        column={col("nextActivity")}
        row={row(null, {
          createdAt: "2025-01-01T00:00:00.000Z",
          lastActivityAt: "2026-05-31T00:00:00.000Z",
        })}
        now={now}
        currency="USD"
      />,
    );
    expect(container.querySelector(".text-warning-soft-foreground")).toBeNull();
  });

  it("prints the mapped source origin label", () => {
    const { container } = render(
      <LeadCell column={col("sourceOrigin")} row={row(null)} now={now} currency="USD" />,
    );
    expect(container.textContent).toBe("Manually created");
  });
});
