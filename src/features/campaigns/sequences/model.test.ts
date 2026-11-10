import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEND_WINDOW,
  nextSendTime,
  type SendWindow,
  sequenceInputSchema,
  totalWaitMinutes,
  zonedTimeToUtc,
} from "./model";

const UTC_9_TO_5: SendWindow = {
  weekdaysOnly: true,
  startHour: 9,
  endHour: 17,
  timezone: "UTC",
};

const EMAIL_STEP = {
  kind: "email" as const,
  subject: "Hello",
  content: { version: 1 as const, settings: {}, blocks: [] },
};

describe("sequence input schema", () => {
  it("applies the 6.10 defaults and keeps a valid email step", () => {
    const parsed = sequenceInputSchema.safeParse({
      name: "Welcome",
      steps: [
        { kind: "email", subject: "Hello", content: { version: 1, settings: {}, blocks: [] } },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sendWindow).toEqual(DEFAULT_SEND_WINDOW);
    expect(parsed.data.entry).toMatchObject({ manual: true, automation: true, segment: null });
    expect(parsed.data.exit).toEqual({ dealWon: false, replied: false, filter: null });
  });

  it("refuses a window that ends before it starts", () => {
    const parsed = sequenceInputSchema.safeParse({
      name: "Bad window",
      sendWindow: { weekdaysOnly: true, startHour: 17, endHour: 9, timezone: "UTC" },
      steps: [EMAIL_STEP],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses an unknown time zone", () => {
    const parsed = sequenceInputSchema.safeParse({
      name: "Bad zone",
      sendWindow: { weekdaysOnly: false, startHour: 0, endHour: 24, timezone: "Mars/Olympus" },
      steps: [EMAIL_STEP],
    });
    expect(parsed.success).toBe(false);
  });

  it("caps the total wait at 90 days", () => {
    const ninetyDays = 90 * 24 * 60;
    expect(totalWaitMinutes([{ kind: "wait", waitMinutes: ninetyDays }])).toBe(ninetyDays);
    const parsed = sequenceInputSchema.safeParse({
      name: "Too long",
      steps: [
        { kind: "wait", waitMinutes: ninetyDays },
        { kind: "wait", waitMinutes: 1 },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("caps the step count at 20", () => {
    const parsed = sequenceInputSchema.safeParse({
      name: "Too many",
      steps: Array.from({ length: 21 }, () => ({ kind: "wait" as const, waitMinutes: 0 })),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("send window arithmetic", () => {
  it("moves a Friday evening into Monday's start hour", () => {
    const fridayEvening = new Date("2026-11-13T18:00:00.000Z");
    expect(nextSendTime(fridayEvening, UTC_9_TO_5).toISOString()).toBe("2026-11-16T09:00:00.000Z");
  });

  it("moves an early Friday to the same day's start hour", () => {
    const fridayMorning = new Date("2026-11-13T08:15:00.000Z");
    expect(nextSendTime(fridayMorning, UTC_9_TO_5).toISOString()).toBe("2026-11-13T09:00:00.000Z");
  });

  it("leaves an in-window weekday alone", () => {
    const wednesday = new Date("2026-11-11T12:30:00.000Z");
    expect(nextSendTime(wednesday, UTC_9_TO_5)).toBe(wednesday);
  });

  it("skips the weekend even inside the clock hours", () => {
    const saturday = new Date("2026-11-14T12:00:00.000Z");
    expect(nextSendTime(saturday, UTC_9_TO_5).toISOString()).toBe("2026-11-16T09:00:00.000Z");
  });

  it("accepts every hour in an all-day window", () => {
    const saturday = new Date("2026-11-14T12:00:00.000Z");
    expect(nextSendTime(saturday, DEFAULT_SEND_WINDOW)).toBe(saturday);
  });

  it("handles a non-UTC zone and DST conversion", () => {
    const london: SendWindow = { ...UTC_9_TO_5, timezone: "Europe/London" };
    // In November London is on GMT, so the local Monday 09:00 start is 09:00 UTC.
    expect(nextSendTime(new Date("2026-11-13T18:00:00.000Z"), london).toISOString()).toBe(
      "2026-11-16T09:00:00.000Z",
    );
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 7, day: 6, hour: 9, minute: 0 },
        "Europe/London",
      ).toISOString(),
    ).toBe("2026-07-06T08:00:00.000Z");
  });

  it("treats the end hour as exclusive", () => {
    const atEnd = new Date("2026-11-11T17:00:00.000Z");
    expect(nextSendTime(atEnd, UTC_9_TO_5).toISOString()).toBe("2026-11-12T09:00:00.000Z");
  });
});
