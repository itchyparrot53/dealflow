"use client";

import type React from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RECURRENCE_MAX_COUNT, RECURRENCE_MAX_INTERVAL } from "@/constants/productivity";
import {
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_WEEKDAY_LABELS,
} from "@/constants/productivityStrings";
import { ActivityDatePicker } from "@/features/activities/ActivityDatePicker";
import {
  describeRule,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_WEEKDAYS,
  type RecurrenceRule,
} from "../rule";

const DEFAULT_RULE: RecurrenceRule = {
  freq: "weekly",
  interval: 1,
  end: { type: "never" },
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// Recurrence editor for the activity dialog (6.3/6.6). Controlled: the dialog owns the rule and
// sends it to setRecurrence after the activity is created or edited. The preview uses the same
// describeRule the badge and the series service use, so the sentence is never a second wording.
export function RecurrenceField({
  value,
  onChange,
}: {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
}): React.ReactNode {
  const enabled = value !== null;
  return (
    <div data-testid="recurrence-field" className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={enabled}
          label="Repeat this activity"
          onCheckedChange={(checked) => {
            onChange(checked === true ? DEFAULT_RULE : null);
          }}
        />
        <span className="text-sm">Repeat</span>
      </div>

      {value !== null && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div data-testid="recurrence-freq">
              <Select
                ariaLabel="Frequency"
                value={value.freq}
                onChange={(next) => {
                  const freq = next as RecurrenceRule["freq"];
                  onChange({
                    ...value,
                    freq,
                    // Weekdays only belong to weekly rules; drop them when the frequency moves on.
                    byWeekday: freq === "weekly" ? value.byWeekday : undefined,
                  });
                }}
                options={RECURRENCE_FREQUENCIES.map((freq) => ({
                  value: freq,
                  label: RECURRENCE_FREQUENCY_LABELS[freq],
                }))}
              />
            </div>
            <span className="text-sm text-muted-foreground">every</span>
            <div data-testid="recurrence-interval">
              <Input
                type="number"
                min={1}
                max={RECURRENCE_MAX_INTERVAL}
                value={String(value.interval)}
                onChange={(event) => {
                  onChange({
                    ...value,
                    interval: clamp(Number(event.target.value), 1, RECURRENCE_MAX_INTERVAL),
                  });
                }}
                aria-label="Interval"
                className="w-20"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {value.freq === "daily"
                ? "days"
                : value.freq === "weekly"
                  ? "weeks"
                  : value.freq === "monthly"
                    ? "months"
                    : "years"}
            </span>
          </div>

          {value.freq === "weekly" && (
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_WEEKDAYS.map((day) => {
                const checked = value.byWeekday?.includes(day) ?? false;
                return (
                  <span
                    key={day}
                    data-testid="recurrence-weekday"
                    data-day={day}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      label={RECURRENCE_WEEKDAY_LABELS[day]}
                      onCheckedChange={(next) => {
                        const current = value.byWeekday ?? [];
                        const days =
                          next === true ? [...current, day] : current.filter((d) => d !== day);
                        onChange({ ...value, byWeekday: days.length === 0 ? undefined : days });
                      }}
                    />
                    {RECURRENCE_WEEKDAY_LABELS[day]}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div data-testid="recurrence-end">
              <Select
                ariaLabel="End"
                value={value.end.type}
                onChange={(next) => {
                  const end =
                    next === "until"
                      ? ({ type: "until", date: "2026-12-31" } as const)
                      : next === "count"
                        ? ({ type: "count", count: 10 } as const)
                        : ({ type: "never" } as const);
                  onChange({ ...value, end });
                }}
                options={[
                  { value: "never", label: "Never ends" },
                  { value: "until", label: "Ends on a date" },
                  { value: "count", label: "Ends after a count" },
                ]}
              />
            </div>
            {value.end.type === "until" && (
              <ActivityDatePicker
                ariaLabel="End date"
                value={value.end.date}
                onChange={(date) => {
                  if (date !== null) onChange({ ...value, end: { type: "until", date } });
                }}
              />
            )}
            {value.end.type === "count" && (
              <Input
                type="number"
                min={2}
                max={RECURRENCE_MAX_COUNT}
                value={String(value.end.count)}
                onChange={(event) => {
                  onChange({
                    ...value,
                    end: {
                      type: "count",
                      count: clamp(Number(event.target.value), 2, RECURRENCE_MAX_COUNT),
                    },
                  });
                }}
                aria-label="Occurrence count"
                className="w-24"
              />
            )}
          </div>

          <p className="text-xs text-muted-foreground" data-testid="recurrence-preview">
            {describeRule(value)}
          </p>
        </>
      )}
    </div>
  );
}
