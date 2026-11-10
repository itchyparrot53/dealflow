"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CampaignDocument } from "../../blocks/schema";
import { CampaignBuilder } from "../../ui/builder/CampaignBuilder";
import type { SequenceStepInput } from "../model";

// The email step opens the same 6.4 builder as a campaign inside a sheet; a wait step is a number
// plus hours or days. Saving here only updates the editor's local definition; the page's Save
// button persists the whole sequence.

export interface SequenceStepDialogProps {
  step: SequenceStepInput;
  index: number;
  onSave: (step: SequenceStepInput) => void;
  onClose: () => void;
}

function minutesToValue(minutes: number): { value: string; unit: "hours" | "days" } {
  if (minutes > 0 && minutes % (24 * 60) === 0) {
    return { value: String(minutes / (24 * 60)), unit: "days" };
  }
  return { value: String(Math.max(1, Math.round(minutes / 60))), unit: "hours" };
}

function EmailStepFields({
  step,
  onSave,
  onClose,
}: {
  step: Extract<SequenceStepInput, { kind: "email" }>;
  onSave: (step: SequenceStepInput) => void;
  onClose: () => void;
}): React.ReactNode {
  const [subject, setSubject] = useState(step.subject);
  const [preheader, setPreheader] = useState(step.preheader ?? "");
  const [content, setContent] = useState<CampaignDocument>(step.content);

  function save(): void {
    if (subject.trim() === "") return;
    onSave({
      ...step,
      subject: subject.trim(),
      preheader: preheader.trim() === "" ? undefined : preheader.trim(),
      content,
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Edit email step</SheetTitle>
      </SheetHeader>
      <SheetBody className="space-y-3">
        <FormField label="Subject" htmlFor="sequence-step-subject" required>
          <Input
            id="sequence-step-subject"
            data-testid="sequence-step-subject"
            value={subject}
            maxLength={200}
            onChange={(event) => setSubject(event.target.value)}
          />
        </FormField>
        <FormField label="Preview line" htmlFor="sequence-step-preheader">
          <Input
            id="sequence-step-preheader"
            value={preheader}
            maxLength={140}
            onChange={(event) => setPreheader(event.target.value)}
          />
        </FormField>
        <CampaignBuilder initialDocument={step.content} onChange={setContent} />
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          data-testid="sequence-step-save"
          onClick={save}
          disabled={subject.trim() === ""}
        >
          Save step
        </Button>
      </SheetFooter>
    </>
  );
}

function WaitStepFields({
  step,
  onSave,
  onClose,
}: {
  step: Extract<SequenceStepInput, { kind: "wait" }>;
  onSave: (step: SequenceStepInput) => void;
  onClose: () => void;
}): React.ReactNode {
  const initial = minutesToValue(step.waitMinutes);
  const [value, setValue] = useState(initial.value);
  const [unit, setUnit] = useState<"hours" | "days">(initial.unit);
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 90 * 24;

  function save(): void {
    const minutes = Math.round(parsed * (unit === "days" ? 24 * 60 : 60));
    onSave({ ...step, waitMinutes: Math.min(minutes, 90 * 24 * 60) });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit wait step</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <FormField label="Wait for" htmlFor="sequence-wait-value" required>
            <Input
              id="sequence-wait-value"
              value={value}
              inputMode="numeric"
              onChange={(event) => setValue(event.target.value)}
            />
          </FormField>
          <FormField label="Unit" htmlFor="sequence-wait-unit">
            <Select
              ariaLabel="Wait unit"
              value={unit}
              onChange={(next) => setUnit(next === "days" ? "days" : "hours")}
              options={[
                { value: "hours", label: "Hours" },
                { value: "days", label: "Days" },
              ]}
            />
          </FormField>
        </div>
        <p className="text-sm text-muted-foreground">
          The whole sequence may wait at most 90 days. A wait is adjusted into the send window.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={!valid}>
          Save step
        </Button>
      </DialogFooter>
    </>
  );
}

export function SequenceStepDialog({
  step,
  index,
  onSave,
  onClose,
}: SequenceStepDialogProps): React.ReactNode {
  if (step.kind === "email") {
    return (
      <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
        <SheetContent closeButton="header" className="w-full sm:max-w-[1100px]">
          <EmailStepFields step={step} onSave={onSave} onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="sm" aria-label={`Edit step ${index + 1}`}>
        <WaitStepFields step={step} onSave={onSave} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
