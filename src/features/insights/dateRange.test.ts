import { describe, expect, it } from "vitest";
import {
  bucketKey,
  bucketLabel,
  fillBuckets,
  localDateKey,
  type RangeSpec,
  resolveRange,
} from "./dateRange";

const NOW = new Date("2026-10-21T10:00:00Z");
const LONDON = "Europe/London";
const NEW_YORK = "America/New_York";
const TOKYO = "Asia/Tokyo";

function iso(at: Date | null): string | null {
  return at === null ? null : at.toISOString();
}

function range(preset: RangeSpec["preset"], over: Partial<RangeSpec> = {}): RangeSpec {
  return { field: "created_at", preset, ...over };
}

function resolved(preset: RangeSpec["preset"], tz: string, over: Partial<RangeSpec> = {}) {
  const { from, to } = resolveRange(range(preset, over), NOW, tz);
  return [iso(from), iso(to)];
}

describe("resolveRange presets", () => {
  it("resolves each preset at 2026-10-21T10:00:00Z in London", () => {
    expect(resolved("this_month", LONDON)).toEqual([
      "2026-09-30T23:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    ]);
    expect(resolved("last_month", LONDON)).toEqual([
      "2026-08-31T23:00:00.000Z",
      "2026-09-30T23:00:00.000Z",
    ]);
    expect(resolved("this_quarter", LONDON)).toEqual([
      "2026-09-30T23:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(resolved("last_quarter", LONDON)).toEqual([
      "2026-06-30T23:00:00.000Z",
      "2026-09-30T23:00:00.000Z",
    ]);
    expect(resolved("this_year", LONDON)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(resolved("last_year", LONDON)).toEqual([
      "2025-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
    expect(resolved("last_30_days", LONDON)).toEqual([
      "2026-09-21T23:00:00.000Z",
      "2026-10-21T23:00:00.000Z",
    ]);
    expect(resolved("last_90_days", LONDON)).toEqual([
      "2026-07-23T23:00:00.000Z",
      "2026-10-21T23:00:00.000Z",
    ]);
    expect(resolved("last_12_months", LONDON)).toEqual([
      "2025-11-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    ]);
    expect(resolved("all_time", LONDON)).toEqual([null, null]);
    expect(
      resolved("custom", LONDON, {
        field: "won_at",
        from: "2026-01-01",
        to: "2026-03-31",
      }),
    ).toEqual(["2026-01-01T00:00:00.000Z", "2026-03-31T23:00:00.000Z"]);
  });

  it("resolves each preset at 2026-10-21T10:00:00Z in New York", () => {
    expect(resolved("this_month", NEW_YORK)).toEqual([
      "2026-10-01T04:00:00.000Z",
      "2026-11-01T04:00:00.000Z",
    ]);
    expect(resolved("last_month", NEW_YORK)).toEqual([
      "2026-09-01T04:00:00.000Z",
      "2026-10-01T04:00:00.000Z",
    ]);
    expect(resolved("this_quarter", NEW_YORK)).toEqual([
      "2026-10-01T04:00:00.000Z",
      "2027-01-01T05:00:00.000Z",
    ]);
    expect(resolved("last_quarter", NEW_YORK)).toEqual([
      "2026-07-01T04:00:00.000Z",
      "2026-10-01T04:00:00.000Z",
    ]);
    expect(resolved("this_year", NEW_YORK)).toEqual([
      "2026-01-01T05:00:00.000Z",
      "2027-01-01T05:00:00.000Z",
    ]);
    expect(resolved("last_year", NEW_YORK)).toEqual([
      "2025-01-01T05:00:00.000Z",
      "2026-01-01T05:00:00.000Z",
    ]);
    expect(resolved("last_30_days", NEW_YORK)).toEqual([
      "2026-09-22T04:00:00.000Z",
      "2026-10-22T04:00:00.000Z",
    ]);
    expect(resolved("last_90_days", NEW_YORK)).toEqual([
      "2026-07-24T04:00:00.000Z",
      "2026-10-22T04:00:00.000Z",
    ]);
    expect(resolved("last_12_months", NEW_YORK)).toEqual([
      "2025-11-01T04:00:00.000Z",
      "2026-11-01T04:00:00.000Z",
    ]);
    expect(resolved("all_time", NEW_YORK)).toEqual([null, null]);
    expect(
      resolved("custom", NEW_YORK, {
        field: "expected_close_date",
        from: "2026-01-01",
        to: "2026-03-31",
      }),
    ).toEqual(["2026-01-01T05:00:00.000Z", "2026-04-01T04:00:00.000Z"]);
  });

  it("makes last_quarter the July to October quarter", () => {
    const { from, to } = resolveRange(range("last_quarter"), NOW, LONDON);
    expect(from === null ? null : localDateKey(from, LONDON)).toBe("2026-07-01");
    expect(to === null ? null : localDateKey(to, LONDON)).toBe("2026-10-01");
  });

  it("uses the viewer's local day for rolling windows across a zone", () => {
    // 01:30 UTC on the 1st is still the previous month in New York.
    const early = new Date("2026-11-01T01:30:00Z");
    const { from } = resolveRange(range("this_month"), early, NEW_YORK);
    expect(from === null ? null : localDateKey(from, NEW_YORK)).toBe("2026-10-01");
  });
});

describe("bucketKey", () => {
  it("keys days, weeks, months, quarters and years in the zone", () => {
    const at = new Date("2026-10-21T10:00:00Z");
    expect(bucketKey(at, "day", LONDON)).toBe("2026-10-21");
    expect(bucketKey(at, "week", LONDON)).toBe("2026-W43");
    expect(bucketKey(at, "month", LONDON)).toBe("2026-10");
    expect(bucketKey(at, "quarter", LONDON)).toBe("2026-Q4");
    expect(bucketKey(at, "year", LONDON)).toBe("2026");
  });

  it("uses ISO weeks across the year boundary", () => {
    expect(bucketKey(new Date("2026-12-31T12:00:00Z"), "week", "UTC")).toBe("2026-W53");
    expect(bucketKey(new Date("2027-01-03T12:00:00Z"), "week", "UTC")).toBe("2026-W53");
    expect(bucketKey(new Date("2027-01-04T12:00:00Z"), "week", "UTC")).toBe("2027-W01");
  });

  it("keys a month at the time-zone boundary", () => {
    const at = new Date("2026-10-31T23:30:00Z");
    expect(bucketKey(at, "month", LONDON)).toBe("2026-10");
    expect(bucketKey(at, "month", TOKYO)).toBe("2026-11");
  });

  it("keys days and years at the time-zone boundary", () => {
    const at = new Date("2027-01-01T00:30:00Z");
    expect(bucketKey(at, "year", LONDON)).toBe("2027");
    expect(bucketKey(at, "year", NEW_YORK)).toBe("2026");
    expect(bucketKey(new Date("2026-10-31T23:30:00Z"), "day", TOKYO)).toBe("2026-11-01");
  });
});

describe("bucketLabel", () => {
  it("labels every interval", () => {
    expect(bucketLabel("2026-10-21", "day")).toBe("21 Oct 2026");
    expect(bucketLabel("2026-W43", "week")).toBe("Week 43, 2026");
    expect(bucketLabel("2026-10", "month")).toBe("Oct 2026");
    expect(bucketLabel("2026-Q4", "quarter")).toBe("Q4 2026");
    expect(bucketLabel("2026", "year")).toBe("2026");
  });
});

describe("fillBuckets", () => {
  const utc = (text: string): Date => new Date(text);

  it("fills every day, month, quarter and year bucket in a half-open range", () => {
    expect(
      fillBuckets(utc("2026-10-01T00:00:00Z"), utc("2026-10-04T00:00:00Z"), "day", "UTC"),
    ).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    const months = fillBuckets(
      utc("2026-01-01T00:00:00Z"),
      utc("2027-01-01T00:00:00Z"),
      "month",
      "UTC",
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-01");
    expect(months[11]).toBe("2026-12");
    expect(
      fillBuckets(utc("2026-01-01T00:00:00Z"), utc("2027-01-01T00:00:00Z"), "quarter", "UTC"),
    ).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
    expect(
      fillBuckets(utc("2024-06-01T00:00:00Z"), utc("2027-01-01T00:00:00Z"), "year", "UTC"),
    ).toEqual(["2024", "2025", "2026"]);
  });

  it("fills weeks, including across a year boundary", () => {
    const weeks = fillBuckets(
      utc("2026-01-01T00:00:00Z"),
      utc("2026-02-01T00:00:00Z"),
      "week",
      "UTC",
    );
    expect(weeks).toEqual(["2026-W01", "2026-W02", "2026-W03", "2026-W04", "2026-W05"]);
    // Jan 11 is the exclusive end, so the last filled bucket is the week that contains Jan 10.
    expect(
      fillBuckets(utc("2026-12-28T00:00:00Z"), utc("2027-01-11T00:00:00Z"), "week", "UTC"),
    ).toEqual(["2026-W53", "2027-W01"]);
  });

  it("returns nothing for an empty or inverted range", () => {
    expect(
      fillBuckets(utc("2026-10-01T00:00:00Z"), utc("2026-10-01T00:00:00Z"), "day", "UTC"),
    ).toEqual([]);
    expect(
      fillBuckets(utc("2026-10-02T00:00:00Z"), utc("2026-10-01T00:00:00Z"), "day", "UTC"),
    ).toEqual([]);
  });

  it("uses the viewer's zone to place the first bucket", () => {
    // 2026-11-01T01:30Z is 21:30 on Oct 31 in New York, so the month bucket is October.
    const buckets = fillBuckets(
      utc("2026-11-01T01:30:00Z"),
      utc("2026-12-01T00:00:00Z"),
      "month",
      NEW_YORK,
    );
    expect(buckets).toEqual(["2026-10", "2026-11"]);
  });
});

describe("localDateKey", () => {
  it("formats the local calendar date", () => {
    expect(localDateKey(new Date("2026-10-31T23:30:00Z"), LONDON)).toBe("2026-10-31");
    expect(localDateKey(new Date("2026-10-31T23:30:00Z"), TOKYO)).toBe("2026-11-01");
  });
});
