import { z } from "zod";
import { RECURRENCE_MAX_COUNT, RECURRENCE_MAX_INTERVAL } from "@/constants/productivity";

// The recurrence rule (6.5). One Zod schema is the contract: the form validates with it, the
// service stores the parsed value, and describeRule renders the same value for the preview badge.

export const RECURRENCE_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type RecurrenceWeekday = (typeof RECURRENCE_WEEKDAYS)[number];

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

const endSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("never") }),
  z.object({ type: z.literal("until"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ type: z.literal("count"), count: z.number().int().min(2).max(RECURRENCE_MAX_COUNT) }),
]);

export const recurrenceRuleSchema = z
  .object({
    freq: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(RECURRENCE_MAX_INTERVAL),
    // Weekly only: the days of the week an occurrence may land on. Absent means "same weekday".
    byWeekday: z.array(z.enum(RECURRENCE_WEEKDAYS)).min(1).max(7).optional(),
    end: endSchema,
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.byWeekday === undefined) return;
    if (rule.freq !== "weekly") {
      ctx.addIssue({
        code: "custom",
        path: ["byWeekday"],
        message: "weekdays apply to weekly rules only",
      });
    }
    if (new Set(rule.byWeekday).size !== rule.byWeekday.length) {
      ctx.addIssue({ code: "custom", path: ["byWeekday"], message: "weekdays must be unique" });
    }
  });

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_LABELS: Record<RecurrenceWeekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  const monthLabel = MONTH_LABELS[Number(month) - 1] ?? "";
  return `${String(Number(day))} ${monthLabel} ${year ?? ""}`;
}

function describeBase(rule: RecurrenceRule): string {
  const { freq, interval } = rule;
  switch (freq) {
    case "daily":
      return interval === 1 ? "Every day" : `Every ${String(interval)} days`;
    case "weekly": {
      const base = interval === 1 ? "Every week" : `Every ${String(interval)} weeks`;
      if (rule.byWeekday === undefined) return base;
      const days = rule.byWeekday.map((day) => WEEKDAY_LABELS[day]).join(", ");
      return `${base} on ${days}`;
    }
    case "monthly":
      return interval === 1 ? "Every month" : `Every ${String(interval)} months`;
    case "yearly":
      return interval === 1 ? "Every year" : `Every ${String(interval)} years`;
  }
}

// "Every 2 weeks on Mon, Thu until 31 Dec 2026" (6.5).
export function describeRule(rule: RecurrenceRule): string {
  const base = describeBase(rule);
  switch (rule.end.type) {
    case "never":
      return base;
    case "until":
      return `${base} until ${formatDate(rule.end.date)}`;
    case "count":
      return `${base} for ${String(rule.end.count)} occurrences`;
  }
}
