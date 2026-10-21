"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { BOOKING_STRINGS } from "@/constants/formsBookingStrings";
import type { Availability } from "../slots";
import type { Weekday } from "../zonedTime";

const S = BOOKING_STRINGS;

const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function quarterHours(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ value, label: value });
    }
  }
  return options;
}

const TIME_OPTIONS = quarterHours();

export function AvailabilityEditor({
  availability,
  onChange,
}: {
  availability: Availability;
  onChange: (next: Availability) => void;
}): React.ReactNode {
  function setRanges(day: Weekday, ranges: Availability[Weekday]): void {
    onChange({ ...availability, [day]: ranges });
  }

  function toggle(day: Weekday, open: boolean): void {
    setRanges(day, open ? [{ from: "09:00", to: "17:00" }] : []);
  }

  function setRange(day: Weekday, index: number, patch: { from?: string; to?: string }): void {
    setRanges(
      day,
      availability[day].map((range, i) => (i === index ? { ...range, ...patch } : range)),
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{S.editor.availability}</h2>
      {DAYS.map((day) => {
        const ranges = availability[day];
        const open = ranges.length > 0;
        return (
          <div
            key={day}
            data-testid="availability-day"
            data-day={day}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <span className="w-20 text-sm">{S.days[day]}</span>
            <Switch
              checked={open}
              onCheckedChange={(next) => toggle(day, next)}
              label={S.editor.enabled}
            />
            {ranges.map((range, index) => (
              <span key={`${day}-${range.from}-${range.to}`} className="flex items-center gap-1">
                <Select
                  value={range.from}
                  onChange={(from) => setRange(day, index, { from })}
                  options={TIME_OPTIONS}
                  ariaLabel={`${S.days[day]} ${S.editor.from}`}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Select
                  value={range.to}
                  onChange={(to) => setRange(day, index, { to })}
                  options={TIME_OPTIONS}
                  ariaLabel={`${S.days[day]} ${S.editor.to}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={S.editor.removeRange}
                  onClick={() =>
                    setRanges(
                      day,
                      ranges.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            ))}
            {open && ranges.length < 3 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRanges(day, [...ranges, { from: "13:00", to: "17:00" }])}
              >
                <Plus className="size-4" /> {S.editor.addRange}
              </Button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
