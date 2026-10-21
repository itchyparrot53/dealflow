import type { z } from "zod";
import type { DatePreset } from "./definition";

// Calendar rules for a custom report range: real dates, in order, at most three years apart. They
// are separate from the schema so both can be read on their own.

function isCalendarDate(text: string): boolean {
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function exceedsThreeYears(from: string, to: string): boolean {
  const [year, month, day] = from.split("-").map(Number);
  const limit = Date.UTC((year ?? 0) + 3, (month ?? 1) - 1, day ?? 1);
  return new Date(`${to}T00:00:00.000Z`).getTime() > limit;
}

export function customRangeIssues(
  range: { preset: DatePreset; from?: string; to?: string },
  ctx: z.RefinementCtx,
): void {
  if (range.preset !== "custom") return;
  if (range.from === undefined) {
    ctx.addIssue({ code: "custom", message: "custom needs a start date", path: ["from"] });
  }
  if (range.to === undefined) {
    ctx.addIssue({ code: "custom", message: "custom needs an end date", path: ["to"] });
  }
  if (range.from === undefined || range.to === undefined) return;
  if (!isCalendarDate(range.from)) {
    ctx.addIssue({ code: "custom", message: "impossible start date", path: ["from"] });
  }
  if (!isCalendarDate(range.to)) {
    ctx.addIssue({ code: "custom", message: "impossible end date", path: ["to"] });
  }
  if (isCalendarDate(range.from) && isCalendarDate(range.to)) {
    if (range.from > range.to) {
      ctx.addIssue({ code: "custom", message: "from must not be after to", path: ["from"] });
    } else if (exceedsThreeYears(range.from, range.to)) {
      ctx.addIssue({ code: "custom", message: "at most three years", path: ["to"] });
    }
  }
}
