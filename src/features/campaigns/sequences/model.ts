import { z } from "zod";
import { SEQUENCE_MAX_STEPS, SEQUENCE_MAX_WAIT_DAYS } from "@/constants/campaigns";
import { type CampaignDocument, campaignDocumentSchema } from "../blocks/schema";

// 6.10's sequence document: the editor, the activator and the scheduler all read this schema, so a
// stored sequence can never describe steps the scheduler cannot run. The time helpers are pure and
// fake-clock friendly; they live here so the UI preview and the scheduler agree on the window.

export const SEQUENCE_STATUSES = ["draft", "active", "paused"] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

const uuid = z.string().uuid();

export const sendWindowSchema = z
  .object({
    weekdaysOnly: z.boolean().default(false),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    timezone: z.string().trim().min(1).max(80).default("UTC"),
  })
  .superRefine((window, ctx) => {
    if (window.endHour <= window.startHour) {
      ctx.addIssue({ code: "custom", message: "The window must end after it starts" });
    }
    if (!isValidTimeZone(window.timezone)) {
      ctx.addIssue({ code: "custom", message: "Unknown time zone" });
    }
  });

export type SendWindow = z.infer<typeof sendWindowSchema>;

export const DEFAULT_SEND_WINDOW: SendWindow = {
  weekdaysOnly: false,
  startHour: 0,
  endHour: 24,
  timezone: "UTC",
};

export const sequenceEntrySchema = z.object({
  // Which entry paths are open. The editor can switch a path off without deleting the sequence.
  manual: z.boolean().default(true),
  automation: z.boolean().default(true),
  segment: z
    .object({
      savedFilterId: uuid,
      allowReentry: z.boolean().default(false),
    })
    .nullable()
    .default(null),
});

export type SequenceEntry = z.infer<typeof sequenceEntrySchema>;

export const DEFAULT_SEQUENCE_ENTRY: SequenceEntry = {
  manual: true,
  automation: true,
  segment: null,
};

export const sequenceExitSchema = z.object({
  dealWon: z.boolean().default(false),
  replied: z.boolean().default(false),
  filter: z.object({ savedFilterId: uuid }).nullable().default(null),
});

export type SequenceExit = z.infer<typeof sequenceExitSchema>;

export const DEFAULT_SEQUENCE_EXIT: SequenceExit = {
  dealWon: false,
  replied: false,
  filter: null,
};

const emailStepSchema = z.object({
  id: uuid.optional(),
  kind: z.literal("email"),
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().max(140).optional(),
  content: campaignDocumentSchema,
});

const waitStepSchema = z.object({
  id: uuid.optional(),
  kind: z.literal("wait"),
  // One wait step at most 90 days; the array refinement caps the total below.
  waitMinutes: z
    .number()
    .int()
    .min(0)
    .max(SEQUENCE_MAX_WAIT_DAYS * 24 * 60),
});

export const sequenceStepSchema = z.discriminatedUnion("kind", [emailStepSchema, waitStepSchema]);
export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;

export function totalWaitMinutes(steps: readonly SequenceStepInput[]): number {
  return steps.reduce(
    (total, step) => (step.kind === "wait" ? total + step.waitMinutes : total),
    0,
  );
}

export const sequenceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    senderId: uuid.nullable().default(null),
    replyTo: z.string().trim().email().max(320).nullable().default(null),
    entry: sequenceEntrySchema.default(DEFAULT_SEQUENCE_ENTRY),
    exit: sequenceExitSchema.default(DEFAULT_SEQUENCE_EXIT),
    sendWindow: sendWindowSchema.default(DEFAULT_SEND_WINDOW),
    steps: z.array(sequenceStepSchema).min(1).max(SEQUENCE_MAX_STEPS),
  })
  .superRefine((input, ctx) => {
    if (totalWaitMinutes(input.steps) > SEQUENCE_MAX_WAIT_DAYS * 24 * 60) {
      ctx.addIssue({ code: "custom", message: "The sequence waits longer than 90 days" });
    }
  });

export type SequenceInput = z.infer<typeof sequenceInputSchema>;

export function defaultSequenceEmailContent(): CampaignDocument {
  return {
    version: 1,
    settings: {
      backgroundColor: "#F4F4F2",
      contentWidth: 600,
      fontFamily: "system",
      linkColor: "#2D8548",
    },
    blocks: [
      {
        id: "seq-heading",
        type: "heading",
        text: "Hello {{person.first_name|there}}",
        level: 1,
        align: "left",
      },
      {
        id: "seq-text",
        type: "text",
        html: "<p>Write the next step of your sequence here.</p>",
      },
    ],
  };
}

export function defaultSequenceEmailStep(): SequenceStepInput {
  return {
    kind: "email",
    subject: "A quick note",
    content: defaultSequenceEmailContent(),
  };
}

// --- Send-window arithmetic -------------------------------------------------

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const existing = FORMATTERS.get(timeZone);
  if (existing !== undefined) return existing;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  FORMATTERS.set(timeZone, created);
  return created;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const value = (type: string): number => {
    const match = parts.find((part) => part.type === type);
    return match === undefined ? 0 : Number(match.value);
  };
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return {
    year,
    month,
    day,
    hour: value("hour"),
    minute: value("minute"),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function addDays(parts: ZonedParts, offset: number): ZonedParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    weekday: date.getUTCDay(),
  };
}

// Convert a wall-clock time in a zone to the matching instant. Iterating the offset handles DST:
// the first pass guesses UTC, then corrects by the difference between the requested and actual
// wall time until it settles.
export function zonedTimeToUtc(parts: Omit<ZonedParts, "weekday">, timeZone: string): Date {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let timestamp = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(timestamp), timeZone);
    const actualWall = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    const difference = desired - actualWall;
    if (difference === 0) break;
    timestamp += difference;
  }
  return new Date(timestamp);
}

// The next instant at or after `desired` that falls inside the sequence's send window. A window
// ending at 24 covers the rest of the local day; an out-of-window time moves to the next allowed
// day's start hour, skipping weekends when the window says so.
export function nextSendTime(desired: Date, window: SendWindow): Date {
  const parts = zonedParts(desired, window.timezone);
  const weekend = parts.weekday === 0 || parts.weekday === 6;
  const withinDay =
    parts.hour > window.startHour || (parts.hour === window.startHour && parts.minute >= 0);
  const beforeEnd = window.endHour === 24 ? true : parts.hour < window.endHour;
  if ((!window.weekdaysOnly || !weekend) && withinDay && beforeEnd) return desired;

  const beforeStart = parts.hour < window.startHour;
  let offset = beforeStart && (!window.weekdaysOnly || !weekend) ? 0 : 1;
  for (; offset <= 8; offset += 1) {
    const day = addDays(parts, offset);
    const dayWeekend = day.weekday === 0 || day.weekday === 6;
    if (window.weekdaysOnly && dayWeekend) continue;
    return zonedTimeToUtc(
      { year: day.year, month: day.month, day: day.day, hour: window.startHour, minute: 0 },
      window.timezone,
    );
  }
  return desired;
}

// Used by the editor's preview copy and the tests.
export function describeSendWindow(window: SendWindow): string {
  const days = window.weekdaysOnly ? "Weekdays" : "Every day";
  return `${days}, ${String(window.startHour).padStart(2, "0")}:00 to ${String(window.endHour).padStart(2, "0")}:00 (${window.timezone})`;
}
