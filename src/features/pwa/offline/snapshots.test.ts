import { describe, expect, test } from "vitest";
import {
  type DealSnapshotInput,
  type OrgSnapshotInput,
  type PersonSnapshotInput,
  type TodaySnapshotInput,
  toDealSnapshot,
  toOrgSnapshot,
  toPersonSnapshot,
  toTodaySnapshot,
} from "./snapshots";

const NOW = new Date("2026-10-22T09:30:00.000Z");
const SAVED_AT = "2026-10-22T09:30:00.000Z";

function dealInput(): DealSnapshotInput {
  return {
    id: "deal-1",
    title: "Acme renewal",
    value: "12500.00",
    currency: "GBP",
    stageName: "Negotiation",
    status: "open",
    personName: "Ada Lovelace",
    orgName: "Acme Ltd",
    ownerName: "Casey Owner",
    nextActivity: { subject: "Send quote", dueAt: "2026-10-23T08:00:00.000Z" },
    recentActivities: [
      {
        subject: "Kickoff call",
        dueAt: "2026-10-20T09:00:00.000Z",
        done: true,
        note: "secret note",
      },
      { subject: "Demo", dueAt: "2026-10-21T09:00:00.000Z", done: true },
      { subject: "Pricing", dueAt: "2026-10-22T09:00:00.000Z", done: false },
    ],
  };
}

describe("toDealSnapshot", () => {
  test("keeps only the listed deal fields", () => {
    const snapshot = toDealSnapshot(dealInput(), NOW);
    expect(Object.keys(snapshot).sort()).toEqual([
      "currency",
      "id",
      "nextActivity",
      "orgName",
      "ownerName",
      "personName",
      "recentActivities",
      "savedAt",
      "stage",
      "status",
      "title",
      "type",
      "value",
    ]);
    expect(snapshot).toEqual({
      type: "deal",
      id: "deal-1",
      title: "Acme renewal",
      value: "12500.00",
      currency: "GBP",
      stage: "Negotiation",
      status: "open",
      personName: "Ada Lovelace",
      orgName: "Acme Ltd",
      ownerName: "Casey Owner",
      nextActivity: { subject: "Send quote", dueAt: "2026-10-23T08:00:00.000Z" },
      recentActivities: [
        { subject: "Kickoff call", dueAt: "2026-10-20T09:00:00.000Z", done: true },
        { subject: "Demo", dueAt: "2026-10-21T09:00:00.000Z", done: true },
        { subject: "Pricing", dueAt: "2026-10-22T09:00:00.000Z", done: false },
      ],
      savedAt: SAVED_AT,
    });
  });

  test("never copies an activity note body", () => {
    const snapshot = toDealSnapshot(dealInput(), NOW);
    expect(JSON.stringify(snapshot)).not.toContain("secret note");
    expect(Object.keys(snapshot.recentActivities[0] ?? {}).sort()).toEqual([
      "done",
      "dueAt",
      "subject",
    ]);
  });

  test("caps recent activities at five", () => {
    const input = dealInput();
    input.recentActivities = Array.from({ length: 7 }, (_, i) => ({
      subject: `activity-${i + 1}`,
      dueAt: null,
      done: false,
    }));
    const snapshot = toDealSnapshot(input, NOW);
    expect(snapshot.recentActivities).toHaveLength(5);
    expect(snapshot.recentActivities.map((a) => a.subject)).toEqual([
      "activity-1",
      "activity-2",
      "activity-3",
      "activity-4",
      "activity-5",
    ]);
  });

  test("tolerates missing links and activities", () => {
    const snapshot = toDealSnapshot(
      {
        id: "deal-2",
        title: "Solo deal",
        value: null,
        currency: "USD",
        stageName: "New",
        status: "open",
        personName: null,
        orgName: null,
        ownerName: null,
      },
      NOW,
    );
    expect(snapshot.nextActivity).toBeNull();
    expect(snapshot.recentActivities).toEqual([]);
    expect(snapshot.value).toBeNull();
  });
});

describe("toPersonSnapshot", () => {
  test("keeps only the listed person fields and no notes", () => {
    const input: PersonSnapshotInput = {
      id: "person-1",
      name: "Ada Lovelace",
      emails: ["ada@acme.test", "ada.personal@example.test"],
      phones: ["+44 20 0000 0000"],
      orgName: "Acme Ltd",
      ownerName: "Casey Owner",
      notes: "secret note body",
    };
    const snapshot = toPersonSnapshot(input, NOW);
    expect(Object.keys(snapshot).sort()).toEqual([
      "emails",
      "id",
      "name",
      "orgName",
      "ownerName",
      "phones",
      "savedAt",
      "type",
    ]);
    expect(snapshot).toEqual({
      type: "person",
      id: "person-1",
      name: "Ada Lovelace",
      emails: ["ada@acme.test", "ada.personal@example.test"],
      phones: ["+44 20 0000 0000"],
      orgName: "Acme Ltd",
      ownerName: "Casey Owner",
      savedAt: SAVED_AT,
    });
    expect(JSON.stringify(snapshot)).not.toContain("secret note body");
  });
});

describe("toOrgSnapshot", () => {
  test("keeps only the listed organization fields", () => {
    const input: OrgSnapshotInput = {
      id: "org-1",
      name: "Acme Ltd",
      address: "1 Example Street, London",
      peopleCount: 4,
      ownerName: null,
    };
    const snapshot = toOrgSnapshot(input, NOW);
    expect(Object.keys(snapshot).sort()).toEqual([
      "address",
      "id",
      "name",
      "ownerName",
      "peopleCount",
      "savedAt",
      "type",
    ]);
    expect(snapshot).toEqual({
      type: "organization",
      id: "org-1",
      name: "Acme Ltd",
      address: "1 Example Street, London",
      peopleCount: 4,
      ownerName: null,
      savedAt: SAVED_AT,
    });
  });
});

describe("toTodaySnapshot", () => {
  test("keeps only the listed item fields", () => {
    const input: TodaySnapshotInput = {
      items: [
        {
          id: "activity-1",
          subject: "Call Ada",
          dueAt: "2026-10-22T10:00:00.000Z",
          done: false,
          dealTitle: "Acme renewal",
        },
        { id: "activity-2", subject: "Send quote", dueAt: null, done: true, dealTitle: null },
      ],
    };
    const snapshot = toTodaySnapshot(input, NOW);
    expect(Object.keys(snapshot).sort()).toEqual(["items", "savedAt", "type"]);
    expect(snapshot.type).toBe("today");
    expect(snapshot.savedAt).toBe(SAVED_AT);
    expect(snapshot.items).toHaveLength(2);
    expect(Object.keys(snapshot.items[0] ?? {}).sort()).toEqual([
      "dealTitle",
      "done",
      "dueAt",
      "id",
      "subject",
    ]);
  });
});
