import { describe, expect, it } from "vitest";
import {
  type Availability,
  availabilitySchema,
  computeSlots,
  DEFAULT_AVAILABILITY,
  type SlotPage,
} from "./slots";

const EMPTY_WEEK: Availability = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

function page(over: Partial<SlotPage> = {}): SlotPage {
  return {
    durationMinutes: 30,
    bufferMinutes: 0,
    minNoticeHours: 0,
    daysAhead: 90,
    timezone: "UTC",
    availability: { ...EMPTY_WEEK, mon: [{ from: "09:00", to: "10:00" }] },
    ...over,
  };
}

const NOW = new Date("2026-10-01T00:00:00Z");

describe("computeSlots", () => {
  it("gives two starts for a one-hour Monday range at 30 minutes", () => {
    // 2026-10-19 is a Monday.
    expect(computeSlots(page(), [], NOW, "2026-10-19", "2026-10-19")).toEqual([
      "2026-10-19T09:00:00.000Z",
      "2026-10-19T09:30:00.000Z",
    ]);
  });

  it("drops both slots when a busy interval covers their middle", () => {
    const busy = [
      { start: new Date("2026-10-19T09:15:00Z"), end: new Date("2026-10-19T09:45:00Z") },
    ];
    expect(computeSlots(page(), busy, NOW, "2026-10-19", "2026-10-19")).toEqual([]);
  });

  it("keeps the 09:30 slot when busy time starts exactly at its end (half-open)", () => {
    const busy = [
      { start: new Date("2026-10-19T10:00:00Z"), end: new Date("2026-10-19T10:30:00Z") },
    ];
    expect(computeSlots(page(), busy, NOW, "2026-10-19", "2026-10-19")).toEqual([
      "2026-10-19T09:00:00.000Z",
      "2026-10-19T09:30:00.000Z",
    ]);
  });

  it("pads busy intervals by the buffer", () => {
    const busy = [
      { start: new Date("2026-10-19T10:00:00Z"), end: new Date("2026-10-19T10:30:00Z") },
    ];
    // With a 30 minute buffer the 09:30 slot now ends at 10:00 + 30 of buffer, so it overlaps.
    expect(
      computeSlots(page({ bufferMinutes: 30 }), busy, NOW, "2026-10-19", "2026-10-19"),
    ).toEqual(["2026-10-19T09:00:00.000Z"]);
  });

  it("applies the minimum notice window", () => {
    const now = new Date("2026-10-19T08:15:00Z");
    expect(computeSlots(page({ minNoticeHours: 1 }), [], now, "2026-10-19", "2026-10-19")).toEqual([
      "2026-10-19T09:30:00.000Z",
    ]);
  });

  it("applies the days-ahead cut-off", () => {
    const p = page({ daysAhead: 10 });
    const slots = computeSlots(p, [], NOW, "2026-10-05", "2026-10-19");
    // 10-05 is inside ten days; 10-12 (eleven days) and 10-19 (eighteen) are not.
    expect(slots).toEqual(["2026-10-05T09:00:00.000Z", "2026-10-05T09:30:00.000Z"]);
  });

  it("keeps 09:00 local on both sides of the London DST change", () => {
    const p = page({
      timezone: "Europe/London",
      availability: {
        ...EMPTY_WEEK,
        sat: [{ from: "09:00", to: "10:00" }],
        sun: [{ from: "09:00", to: "10:00" }],
      },
    });
    // 2026-10-24 is the last BST Saturday, 2026-10-25 the first GMT Sunday.
    expect(computeSlots(p, [], NOW, "2026-10-24", "2026-10-25")).toEqual([
      "2026-10-24T08:00:00.000Z",
      "2026-10-24T08:30:00.000Z",
      "2026-10-25T09:00:00.000Z",
      "2026-10-25T09:30:00.000Z",
    ]);
  });

  it("clamps a window wider than 14 days instead of refusing it", () => {
    const slots = computeSlots(page({ daysAhead: 90 }), [], NOW, "2026-10-19", "2026-11-30");
    // Only Mondays 10-19 and 10-26 fall inside the clamped 14-day window (10-19..11-01).
    expect(slots).toEqual([
      "2026-10-19T09:00:00.000Z",
      "2026-10-19T09:30:00.000Z",
      "2026-10-26T09:00:00.000Z",
      "2026-10-26T09:30:00.000Z",
    ]);
    expect(slots.some((s) => s.startsWith("2026-11-02"))).toBe(false);
  });

  it("returns nothing for a day with no availability", () => {
    expect(computeSlots(page(), [], NOW, "2026-10-20", "2026-10-20")).toEqual([]);
  });
});

describe("availabilitySchema", () => {
  it("accepts the default week", () => {
    expect(availabilitySchema.safeParse(DEFAULT_AVAILABILITY).success).toBe(true);
  });

  it("defaults to Monday to Friday 09:00 to 17:00 with an empty weekend", () => {
    expect(DEFAULT_AVAILABILITY.mon).toEqual([{ from: "09:00", to: "17:00" }]);
    expect(DEFAULT_AVAILABILITY.fri).toEqual([{ from: "09:00", to: "17:00" }]);
    expect(DEFAULT_AVAILABILITY.sat).toEqual([]);
    expect(DEFAULT_AVAILABILITY.sun).toEqual([]);
  });

  it("rejects a range whose end is not after its start", () => {
    const bad = { ...DEFAULT_AVAILABILITY, mon: [{ from: "10:00", to: "10:00" }] };
    expect(availabilitySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects overlapping ranges on one day", () => {
    const bad = {
      ...DEFAULT_AVAILABILITY,
      mon: [
        { from: "09:00", to: "12:00" },
        { from: "11:00", to: "13:00" },
      ],
    };
    expect(availabilitySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects more than three ranges a day", () => {
    const bad = {
      ...DEFAULT_AVAILABILITY,
      mon: [
        { from: "08:00", to: "09:00" },
        { from: "09:00", to: "10:00" },
        { from: "10:00", to: "11:00" },
        { from: "11:00", to: "12:00" },
      ],
    };
    expect(availabilitySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a malformed time", () => {
    const bad = { ...DEFAULT_AVAILABILITY, mon: [{ from: "9:00", to: "17:00" }] };
    expect(availabilitySchema.safeParse(bad).success).toBe(false);
  });
});
