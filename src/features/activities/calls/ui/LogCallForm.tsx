"use client";

import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Textarea } from "@/components/ui/Textarea";
import type { CallDirection, CallOutcome } from "@/constants/productivity";
import { CALL_DIRECTIONS, CALL_OUTCOMES } from "@/constants/productivity";
import {
  CALL_DIRECTION_LABELS,
  CALL_OUTCOME_LABELS,
  PRODUCTIVITY_STRINGS,
} from "@/constants/productivityStrings";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { logCallAction } from "../actions";

export interface LogCallTarget {
  dealId?: string;
  personId?: string;
  organizationId?: string;
  label?: string;
}

const CHIP =
  "cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-foreground";

// Call logging form (6.6): outcome (chips), direction, duration in minutes and seconds, a note,
// then Save. Writes through the server action, which validates again and reuses createActivity.
export function LogCallForm({
  target,
  open,
  onClose,
  onSaved,
}: {
  target: LogCallTarget;
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}): React.ReactNode {
  const utils = trpc.useUtils();
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [direction, setDirection] = useState<CallDirection>("outbound");
  const [minutes, setMinutes] = useState("0");
  const [seconds, setSeconds] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErrorId(null);
    const durationSeconds =
      Math.max(0, Number(minutes) || 0) * 60 + Math.max(0, Math.min(59, Number(seconds) || 0));
    const result = await logCallAction(
      {
        dealId: target.dealId ?? null,
        personId: target.personId ?? null,
        organizationId: target.organizationId ?? null,
        outcome,
        direction,
        durationSeconds,
        note: note.trim() === "" ? null : note,
        at: new Date().toISOString(),
      },
      readCsrfToken(),
    );
    setBusy(false);
    if (!result.ok) {
      setErrorId(result.error.id);
      return;
    }
    await Promise.all([
      utils.activities.listForEntity.invalidate(),
      utils.activities.calendarRange.invalidate(),
      utils.activities.listRows.invalidate(),
      utils.contacts.contactTimeline.invalidate(),
    ]);
    onSaved?.(result.value.id);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid="log-call-form">
        <DialogHeader>
          <DialogTitle>Log call{target.label === undefined ? "" : `: ${target.label}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Outcome</Label>
            <RadioGroup
              value={outcome}
              onValueChange={(value) => {
                setOutcome(value as CallOutcome);
              }}
              className="flex flex-wrap gap-2"
            >
              {CALL_OUTCOMES.map((value) => (
                <RadioGroupItem
                  key={value}
                  value={value}
                  data-testid="call-outcome"
                  data-outcome={value}
                  className={CHIP}
                >
                  {CALL_OUTCOME_LABELS[value]}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Direction</Label>
            <RadioGroup
              value={direction}
              onValueChange={(value) => {
                setDirection(value as CallDirection);
              }}
              className="flex flex-wrap gap-2"
              data-testid="call-direction"
            >
              {CALL_DIRECTIONS.map((value) => (
                <RadioGroupItem key={value} value={value} className={CHIP}>
                  {CALL_DIRECTION_LABELS[value]}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="log-call-minutes">Duration</Label>
            <div className="flex items-center gap-2" data-testid="call-duration">
              <Input
                id="log-call-minutes"
                type="number"
                min={0}
                max={1440}
                value={minutes}
                onChange={(event) => {
                  setMinutes(event.target.value);
                }}
                className="w-20"
                aria-label="Minutes"
              />
              <span className="text-sm text-muted-foreground">min</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={seconds}
                onChange={(event) => {
                  setSeconds(event.target.value);
                }}
                className="w-20"
                aria-label="Seconds"
              />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="log-call-note">Notes</Label>
            <Textarea
              id="log-call-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              rows={3}
            />
          </div>

          {errorId !== null && (
            <p role="alert" className="text-sm text-destructive">
              {errorId === "E_CALL_001" ? (
                <>
                  {PRODUCTIVITY_STRINGS.callNoType}{" "}
                  <Link href="/settings/company/activities" className="underline">
                    Open activity types
                  </Link>
                </>
              ) : (
                PRODUCTIVITY_STRINGS.callInvalid
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" data-testid="call-save" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
