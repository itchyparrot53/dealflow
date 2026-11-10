"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { readCsrfToken } from "@/utils/csrfCookie";
import type { CampaignDocument } from "../../blocks/schema";
import {
  activateSequenceAction,
  deleteSequenceAction,
  pauseSequenceAction,
  updateSequenceAction,
} from "../actions";
import {
  defaultSequenceEmailStep,
  type SendWindow,
  type SequenceEntry,
  type SequenceExit,
  type SequenceStepInput,
} from "../model";
import type { SequenceEditorView, SequenceStepStats, SequenceStepView } from "../queries";
import { SequenceStepDialog } from "./SequenceStepDialog";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success"> = {
  draft: "outline",
  active: "success",
  paused: "secondary",
};

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}));
const END_HOURS = Array.from({ length: 24 }, (_, index) => ({
  value: String(index + 1),
  label: `${String(index + 1).padStart(2, "0")}:00`,
}));

function stepToInput(step: SequenceStepView): SequenceStepInput {
  if (step.kind === "wait") {
    return { id: step.id, kind: "wait", waitMinutes: step.waitMinutes ?? 0 };
  }
  return {
    id: step.id,
    kind: "email",
    subject: step.subject ?? "Sequence email",
    preheader: step.preheader ?? undefined,
    content: step.content as CampaignDocument,
  };
}

function waitLabel(minutes: number): string {
  if (minutes > 0 && minutes % (24 * 60) === 0) {
    return `${minutes / (24 * 60)} day${minutes === 24 * 60 ? "" : "s"}`;
  }
  if (minutes > 0 && minutes % 60 === 0) {
    return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function rate(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function StepStats({ stats }: { stats: SequenceStepStats | null }): React.ReactNode {
  if (stats === null) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
      Sent {stats.sent}, delivered {stats.delivered}, open {rate(stats.openRate)}, click{" "}
      {rate(stats.clickRate)}
    </p>
  );
}

function SegmentFields({
  segment,
  savedFilters,
  onChange,
}: {
  segment: NonNullable<SequenceEntry["segment"]>;
  savedFilters: { id: string; name: string }[];
  onChange: (segment: NonNullable<SequenceEntry["segment"]>) => void;
}): React.ReactNode {
  return (
    <>
      <Select
        ariaLabel="Segment filter"
        value={segment.savedFilterId}
        onChange={(value) => onChange({ ...segment, savedFilterId: value })}
        options={savedFilters.map((filter) => ({ value: filter.id, label: filter.name }))}
      />
      <label htmlFor="sequence-entry-reentry" className="flex items-center gap-2 text-sm">
        <Checkbox
          id="sequence-entry-reentry"
          checked={segment.allowReentry}
          onCheckedChange={(checked) => onChange({ ...segment, allowReentry: checked })}
          label="Allow re-entry"
        />
        Allow re-entry
      </label>
    </>
  );
}

export function SequenceEditor({ view }: { view: SequenceEditorView }): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(view.name);
  const [senderId, setSenderId] = useState(view.senderId ?? "");
  const [replyTo, setReplyTo] = useState(view.replyTo ?? "");
  const [entry, setEntry] = useState<SequenceEntry>(view.entry);
  const [exit, setExit] = useState<SequenceExit>(view.exit);
  const [sendWindow, setSendWindow] = useState<SendWindow>(view.sendWindow);
  const [steps, setSteps] = useState<SequenceStepInput[]>(view.steps.map(stepToInput));
  const [editing, setEditing] = useState<number | null>(null);
  const statsById = new Map(
    view.steps.filter((step) => step.stats !== null).map((step) => [step.id, step.stats]),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchWindow(patch: Partial<SendWindow>): void {
    setSendWindow((current) => ({ ...current, ...patch }));
  }

  function replaceStep(index: number, step: SequenceStepInput): void {
    setSteps((current) => current.map((value, position) => (position === index ? step : value)));
  }

  function removeStep(index: number): void {
    setSteps((current) => current.filter((_, position) => position !== index));
    setEditing(null);
  }

  function moveStep(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item !== undefined) next.splice(target, 0, item);
      return next;
    });
  }

  function addEmail(): void {
    setSteps((current) => [...current, defaultSequenceEmailStep()]);
    setEditing(steps.length);
  }

  function addWait(): void {
    setSteps((current) => [...current, { kind: "wait", waitMinutes: 24 * 60 }]);
    setEditing(steps.length);
  }

  function input() {
    return {
      name: name.trim(),
      senderId: senderId === "" ? null : senderId,
      replyTo: replyTo.trim() === "" ? null : replyTo.trim(),
      entry,
      exit,
      sendWindow,
      steps,
    };
  }

  async function persist(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateSequenceAction({ id: view.id, input: input() }, readCsrfToken());
    setSaving(false);
    if (!result.ok) {
      setError(result.error.id);
      return false;
    }
    // A newly added step has no id yet. Adopt the server's ids before another save, or the next
    // save would insert a second row for the same step and delete the first one's campaign stats.
    const savedSteps = result.value.steps;
    setSteps((current) =>
      current.map((step, index) => {
        if (step.id !== undefined) return step;
        const saved = savedSteps.find((row) => row.position === index);
        return saved === undefined ? step : { ...step, id: saved.id };
      }),
    );
    setSaved(true);
    router.refresh();
    return true;
  }

  async function activate(): Promise<void> {
    if (!(await persist())) return;
    const result = await activateSequenceAction({ id: view.id }, readCsrfToken());
    if (!result.ok) setError(result.error.id);
    else router.refresh();
  }

  async function pause(): Promise<void> {
    const result = await pauseSequenceAction({ id: view.id }, readCsrfToken());
    if (!result.ok) setError(result.error.id);
    else router.refresh();
  }

  async function remove(): Promise<void> {
    const result = await deleteSequenceAction({ id: view.id }, readCsrfToken());
    if (!result.ok) setError(result.error.id);
    else router.push("/campaigns/automated");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[view.status] ?? "outline"}>{view.status}</Badge>
          <span className="text-sm text-muted-foreground">
            {view.enrollments.active} active, {view.enrollments.completed} completed,{" "}
            {view.enrollments.exited} exited
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="sequence-save"
            onClick={() => void persist()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          {view.status === "active" ? (
            <Button
              type="button"
              variant="outline"
              data-testid="sequence-pause"
              onClick={() => void pause()}
            >
              Pause
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="sequence-activate"
              onClick={() => void activate()}
              disabled={saving}
            >
              Activate
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </header>

      {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
      {saved ? <p className="text-sm text-muted-foreground">Saved</p> : null}
      {view.hasPostalAddress ? null : (
        <p className="text-sm text-destructive">
          Set the postal address in Settings - Campaigns before activating.
        </p>
      )}

      <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <FormField label="Name" htmlFor="sequence-name" required>
          <Input
            id="sequence-name"
            data-testid="sequence-name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Sender" htmlFor="sequence-sender">
          <Select
            ariaLabel="Sender"
            value={senderId}
            onChange={setSenderId}
            placeholder="No sender"
            options={[
              { value: "", label: "No sender" },
              ...view.senders.map((sender) => ({
                value: sender.id,
                label: `${sender.fromName} <${sender.fromEmail}>${sender.verified ? "" : " (unverified)"}`,
              })),
            ]}
          />
        </FormField>
        <FormField label="Reply-to" htmlFor="sequence-reply-to">
          <Input
            id="sequence-reply-to"
            type="email"
            value={replyTo}
            onChange={(event) => setReplyTo(event.target.value)}
          />
        </FormField>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Send window</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Select
            ariaLabel="Window start hour"
            value={String(sendWindow.startHour)}
            onChange={(value) => patchWindow({ startHour: Number(value) })}
            options={HOURS}
          />
          <Select
            ariaLabel="Window end hour"
            value={String(sendWindow.endHour)}
            onChange={(value) => patchWindow({ endHour: Number(value) })}
            options={END_HOURS}
          />
          <Input
            aria-label="Time zone"
            value={sendWindow.timezone}
            onChange={(event) => patchWindow({ timezone: event.target.value })}
          />
          <label htmlFor="sequence-weekdays-only" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-weekdays-only"
              checked={sendWindow.weekdaysOnly}
              onCheckedChange={(checked) => patchWindow({ weekdaysOnly: checked })}
              label="Weekdays only"
            />
            Weekdays only
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Steps</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="sequence-add-email"
              onClick={addEmail}
            >
              + Email
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="sequence-add-wait"
              onClick={addWait}
            >
              + Wait
            </Button>
          </div>
        </div>
        <ol className="relative ml-2 space-y-3 border-l border-dashed border-border-strong pl-6">
          {steps.map((step, index) => (
            <li key={step.id ?? `new-${index}`} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {index + 1}.{" "}
                    {step.kind === "email"
                      ? `Email: ${step.subject}`
                      : `Wait ${waitLabel(step.waitMinutes)}`}
                  </p>
                  {step.kind === "email" ? (
                    <StepStats
                      stats={step.id === undefined ? null : (statsById.get(step.id) ?? null)}
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(index)}
                  >
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeStep(index)}>
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Entry</h2>
          <label htmlFor="sequence-entry-manual" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-entry-manual"
              checked={entry.manual}
              onCheckedChange={(checked) => setEntry({ ...entry, manual: checked })}
              label="Allow manual enrollment"
            />
            Manual enrollment
          </label>
          <label htmlFor="sequence-entry-automation" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-entry-automation"
              checked={entry.automation}
              onCheckedChange={(checked) => setEntry({ ...entry, automation: checked })}
              label="Allow the automation action"
            />
            Automation action
          </label>
          <label htmlFor="sequence-entry-segment" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-entry-segment"
              checked={entry.segment !== null}
              onCheckedChange={(checked) =>
                setEntry({
                  ...entry,
                  segment: checked
                    ? { savedFilterId: view.savedFilters[0]?.id ?? "", allowReentry: false }
                    : null,
                })
              }
              label="Enroll from a saved filter"
            />
            Segment entry
          </label>
          {entry.segment === null ? null : (
            <SegmentFields
              segment={entry.segment}
              savedFilters={view.savedFilters}
              onChange={(segment) => setEntry({ ...entry, segment })}
            />
          )}
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Exit</h2>
          <label htmlFor="sequence-exit-deal-won" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-exit-deal-won"
              checked={exit.dealWon}
              onCheckedChange={(checked) => setExit({ ...exit, dealWon: checked })}
              label="Exit when a deal is won"
            />
            When a deal is won
          </label>
          <label htmlFor="sequence-exit-replied" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-exit-replied"
              checked={exit.replied}
              onCheckedChange={(checked) => setExit({ ...exit, replied: checked })}
              label="Exit when the person replies"
            />
            When the person replies
          </label>
          <label htmlFor="sequence-exit-filter" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="sequence-exit-filter"
              checked={exit.filter !== null}
              onCheckedChange={(checked) =>
                setExit({
                  ...exit,
                  filter: checked ? { savedFilterId: view.savedFilters[0]?.id ?? "" } : null,
                })
              }
              label="Exit when the person is in a filter"
            />
            When the person is in a filter
          </label>
          {exit.filter === null ? null : (
            <Select
              ariaLabel="Exit filter"
              value={exit.filter.savedFilterId}
              onChange={(value) => setExit({ ...exit, filter: { savedFilterId: value } })}
              options={view.savedFilters.map((filter) => ({
                value: filter.id,
                label: filter.name,
              }))}
            />
          )}
        </div>
      </section>

      {editing === null ? null : (
        <SequenceStepDialog
          key={editing}
          step={steps[editing] ?? defaultSequenceEmailStep()}
          index={editing}
          onClose={() => setEditing(null)}
          onSave={(step) => {
            replaceStep(editing, step);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
