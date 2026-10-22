// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { DealCard } from "./DealCard";

// Deal rotting (6.8.1): a 3 px warning left border on a white card, not a graded red fill. The rot
// level still comes from rottingState; the card maps every level to the same border and the age.
const baseCard = {
  id: "d1",
  title: "Acme renewal",
  value: "25000.00",
  stageId: "s1",
  boardPosition: "1",
  ownerId: "u1",
  personId: "p1",
  orgId: "o1",
  nextActivityAt: null,
  lastActivityAt: null,
  stageEnteredAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
};

const now = new Date("2026-06-20T00:00:00Z");

function renderAt(enteredAt: string) {
  return render(
    <DealCard
      card={{ ...baseCard, stageEnteredAt: new Date(enteredAt) }}
      ownerName="A.K."
      personName={null}
      orgName={null}
      labels={[]}
      rottingDays={6}
      density="comfortable"
      now={now}
    />,
  );
}

describe("DealCard rot tint", () => {
  it("puts a 3 px warning border on a rotting card (level 1)", () => {
    // age 7, R=6 -> level 1
    renderAt("2026-06-13T00:00:00Z");
    const card = screen.getByRole("button", { name: /Acme renewal/ });
    expect(card.className).toContain("border-l-[3px]");
    expect(card.className).toContain("border-l-warning");
    expect(card.className).not.toMatch(/bg-red-\d/);
  });

  it("keeps the same warning border at the strongest rot", () => {
    // age 12, R=6 -> level 3
    renderAt("2026-06-08T00:00:00Z");
    const card = screen.getByRole("button", { name: /Acme renewal/ });
    expect(card.className).toContain("border-l-warning");
    expect(card.className).not.toMatch(/bg-red-\d/);
  });

  it("never rots a closed deal, however long it has sat in its last stage", () => {
    for (const status of ["won", "lost"] as const) {
      cleanup();
      render(
        <DealCard
          card={{ ...baseCard, status, stageEnteredAt: new Date("2026-06-08T00:00:00Z") }}
          ownerName="A.K."
          personName={null}
          orgName={null}
          labels={[]}
          rottingDays={6}
          density="comfortable"
          now={now}
        />,
      );
      const card = screen.getByRole("button", { name: /Acme renewal/ });
      expect(card.className, status).not.toContain("border-l-warning");
      expect(screen.queryByRole("status", { name: /rotting/ }), status).toBeNull();
    }
  });

  it("does not mark a healthy card (age at or below the threshold)", () => {
    // age 4, R=6 -> level 0
    renderAt("2026-06-16T00:00:00Z");
    const card = screen.getByRole("button", { name: /Acme renewal/ });
    expect(card.className).not.toContain("border-l-warning");
  });

  // The clock is seeded from the request, so a rotting card reads as rotting in the very first
  // paint. The card must never describe a deal that has an activity as having nothing scheduled:
  // an absent clock used to produce that claim, which is a wrong answer rather than a blank one.
  it("shows rot and the real activity state in the first render", () => {
    render(
      <DealCard
        card={{
          ...baseCard,
          stageEnteredAt: new Date("2026-06-08T00:00:00Z"),
          nextActivityAt: new Date("2026-06-18T09:00:00Z"),
          nextActivityTitle: "Discovery call",
        }}
        ownerName="A.K."
        personName={null}
        orgName={null}
        labels={[]}
        rottingDays={6}
        density="comfortable"
        now={new Date("2026-06-21T00:00:00Z")}
      />,
    );
    const card = screen.getByRole("button", { name: /Acme renewal/ });
    expect(card.className).toContain("border-l-warning");
    expect(screen.queryByLabelText("No activity scheduled")).toBeNull();
    expect(screen.getByLabelText("Discovery call · 3 days overdue")).not.toBeNull();
  });
});
