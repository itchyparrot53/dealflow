"use client";

import { useEffect, useMemo, useState } from "react";
import { usePageTitle } from "@/components/shell/pageTitle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
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
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPES, type CampaignType } from "@/constants/campaigns";
import { ContactFilterBuilder } from "@/features/contacts/ContactFilterBuilder";
import { PERSON_FILTER_CONFIG } from "@/features/contacts/contactFilterConfig";
import { PERSON_FILTER_LABELS } from "@/features/contacts/contactFilterRows";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  cancelCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
  scheduleCampaignAction,
  sendCampaignNowAction,
  sendCampaignTestAction,
  suggestCampaignSubjectsAction,
  unscheduleCampaignAction,
  updateCampaignAction,
} from "../actions";
import { auditDocument } from "../blocks/audit";
import type { CampaignDocument } from "../blocks/schema";
import { type ChecklistItem, campaignChecklist } from "../checklist";
import type { CampaignSegment } from "../schemas";
import type { SegmentPreview } from "../segment";
import { CampaignBuilder } from "./builder/CampaignBuilder";

// 3.1's four-step editor: Details, Recipients, Content, Review. It autosaves 800 ms after the last
// change; sending, scheduling and pause/resume arrive with the sending engine (Task 3.3).

const STEPS = ["details", "recipients", "content", "review"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  details: "Details",
  recipients: "Recipients",
  content: "Content",
  review: "Review",
};

export interface EditorFormState {
  name: string;
  type: CampaignType;
  subject: string;
  preheader: string;
  replyTo: string;
  senderId: string | null;
  segment: CampaignSegment | null;
  content: CampaignDocument | null;
}

const BLANK_DOC: CampaignDocument = {
  version: 1,
  settings: {
    backgroundColor: "#F4F4F2",
    contentWidth: 600,
    fontFamily: "system",
    linkColor: "#2D8548",
  },
  blocks: [],
};

export function CampaignEditor({ campaignId }: { campaignId: string }): React.ReactNode {
  const data = trpc.campaigns.get.useQuery({ id: campaignId });
  if (data.data === null || data.data === undefined) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {data.isLoading ? "Loading campaign..." : "This campaign does not exist."}
      </p>
    );
  }
  return (
    <EditorForm
      key={campaignId}
      campaignId={campaignId}
      campaign={data.data.campaign}
      status={data.data.campaign.status}
      senders={data.data.senders}
      postalAddress={data.data.postalAddress}
    />
  );
}

interface EditorFormProps {
  campaignId: string;
  campaign: {
    name: string;
    type: string;
    subject: string;
    preheader: string | null;
    replyTo: string | null;
    senderId: string | null;
    segment: unknown;
    content: unknown;
    status: string;
  };
  status: string;
  senders: { id: string; fromName: string; fromEmail: string; verified: boolean }[];
  postalAddress: string;
}

function TestSendMessage({
  message,
  sent,
}: {
  message: string | null;
  sent: boolean;
}): React.ReactNode {
  if (message === null) return null;
  return (
    <p
      data-testid={sent ? "campaign-test-sent" : undefined}
      className={sent ? "text-sm text-link-record" : "text-sm text-destructive"}
    >
      {message}
    </p>
  );
}

interface TestSendInput {
  document: CampaignDocument;
  subject: string;
  preheader: string;
  personId: string;
  recipients: string;
  senderId: string | null;
}

async function runTestSend(
  input: TestSendInput,
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const recipients = input.recipients
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => value !== "");
  if (recipients.length === 0 || input.personId === "") {
    return { ok: false, error: "Add a recipient and choose a sample person." };
  }
  const result = await sendCampaignTestAction(
    {
      document: input.document,
      subject: input.subject,
      preheader: input.preheader === "" ? undefined : input.preheader,
      personId: input.personId,
      recipients,
      senderId: input.senderId,
    },
    readCsrfToken(),
  );
  return result.ok ? { ok: true, sent: result.value.sent } : { ok: false, error: result.error.id };
}

export function EditorForm({
  campaignId,
  campaign,
  status,
  senders,
  postalAddress,
}: EditorFormProps): React.ReactNode {
  const [form, setForm] = useState<EditorFormState>({
    name: campaign.name,
    type: campaign.type as CampaignType,
    subject: campaign.subject,
    preheader: campaign.preheader ?? "",
    replyTo: campaign.replyTo ?? "",
    senderId: campaign.senderId,
    segment: (campaign.segment as CampaignSegment | null) ?? null,
    content: (campaign.content as CampaignDocument | null) ?? null,
  });
  const [step, setStep] = useState<Step>("details");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildFilter, setBuildFilter] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRecipients, setTestRecipients] = useState("");
  const [testPersonId, setTestPersonId] = useState("");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleHour, setScheduleHour] = useState("10");
  const [scheduleMinute, setScheduleMinute] = useState("00");
  usePageTitle(form.name);

  function patch(next: Partial<EditorFormState>): void {
    setForm((current) => ({ ...current, ...next }));
    setDirty(true);
  }

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await updateCampaignAction(
          {
            id: campaignId,
            name: form.name,
            type: form.type,
            subject: form.subject,
            preheader: form.preheader === "" ? null : form.preheader,
            replyTo: form.replyTo === "" ? null : form.replyTo,
            senderId: form.senderId,
            segment: form.segment,
            content: form.content,
          },
          readCsrfToken(),
        );
        if (!result.ok) {
          setError(result.error.id);
          return;
        }
        setDirty(false);
        setSaved(true);
      })();
    }, 800);
    return () => clearTimeout(timer);
  }, [form, dirty, campaignId]);

  const segmentQuery = trpc.campaigns.segmentPreview.useQuery(
    {
      segment: form.segment ?? {
        kind: "definition",
        definition: { combinator: "and", conditions: [] },
      },
    },
    { enabled: form.segment !== null },
  );
  const preview = trpc.campaigns.preview.useQuery(
    { document: form.content ?? BLANK_DOC },
    { enabled: form.content !== null, placeholderData: (previous) => previous },
  );

  const selectedSender = senders.find((sender) => sender.id === form.senderId);
  const checklist = useMemo(() => {
    const audit = auditDocument(form.content ?? BLANK_DOC);
    return campaignChecklist({
      subject: form.subject,
      senderVerified: selectedSender?.verified ?? false,
      postalAddress,
      recipientCount: segmentQuery.data?.eligible.length ?? 0,
      imagesWithoutAlt: audit.imagesWithoutAlt,
      buttonsWithoutUrl: audit.buttonsWithoutUrl,
      htmlBytes: preview.data?.bytes ?? 0,
      domainCheck: null,
      testSent,
    });
  }, [form, selectedSender, postalAddress, segmentQuery.data, preview.data, testSent]);

  async function run(
    action: () => Promise<{ ok: boolean; error?: { id: string } }>,
  ): Promise<void> {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error?.id ?? "error");
      return;
    }
    window.location.reload();
  }

  async function sendNow(): Promise<void> {
    setConfirmSend(false);
    await run(() => sendCampaignNowAction({ id: campaignId }, readCsrfToken()));
  }

  async function sendTest(): Promise<void> {
    setTestMessage(null);
    const result = await runTestSend({
      document: form.content ?? BLANK_DOC,
      subject: form.subject,
      preheader: form.preheader,
      personId: testPersonId,
      recipients: testRecipients,
      senderId: form.senderId,
    });
    if (!result.ok) {
      setTestMessage(result.error);
      return;
    }
    setTestSent(true);
    setTestMessage(`Sent ${result.sent} test email${result.sent === 1 ? "" : "s"}.`);
  }

  async function schedule(): Promise<void> {
    if (scheduleDate === null) return;
    const at = new Date(`${scheduleDate}T${scheduleHour}:${scheduleMinute}:00`);
    await run(() =>
      scheduleCampaignAction({ id: campaignId, scheduledAt: at.toISOString() }, readCsrfToken()),
    );
  }

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{campaign.status}</Badge>
          {saved && !dirty ? <span className="text-xs text-muted-foreground">Saved</span> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {status === "sending" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void run(() => pauseCampaignAction({ id: campaignId }, readCsrfToken()))
              }
            >
              Pause
            </Button>
          ) : null}
          {status === "paused" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void run(() => resumeCampaignAction({ id: campaignId }, readCsrfToken()))
              }
            >
              Resume
            </Button>
          ) : null}
          {status === "scheduled" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void run(() => unscheduleCampaignAction({ id: campaignId }, readCsrfToken()))
              }
            >
              Unschedule
            </Button>
          ) : null}
          {["sending", "paused", "scheduled"].includes(status) ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() =>
                void run(() => cancelCampaignAction({ id: campaignId }, readCsrfToken()))
              }
            >
              Cancel campaign
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="campaign-send-test"
            disabled={form.content === null}
            onClick={() => {
              setTestMessage(null);
              setTestPersonId((current) =>
                current === "" ? (segmentQuery.data?.eligible[0]?.id ?? "") : current,
              );
              setTestOpen(true);
            }}
          >
            Send test
          </Button>
          {STEPS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={step === value ? "default" : "outline"}
              data-testid={`campaign-step-${value}`}
              onClick={() => setStep(value)}
            >
              {STEP_LABELS[value]}
            </Button>
          ))}
        </div>
      </header>

      {error === null ? null : <p className="text-sm text-destructive">{error}</p>}

      {step === "details" ? (
        <DetailsStep
          form={form}
          patch={patch}
          senders={senders}
          suggestions={suggestions}
          onSuggest={() =>
            void (async () => {
              const result = await suggestCampaignSubjectsAction(
                { name: form.name, type: form.type },
                readCsrfToken(),
              );
              if (result.ok) setSuggestions(result.value.subjects);
              else setError(result.error.id);
            })()
          }
          onPick={(subject) => {
            patch({ subject });
            setSuggestions([]);
          }}
        />
      ) : null}

      {step === "recipients" ? (
        <RecipientsStep
          form={form}
          patch={patch}
          buildFilter={buildFilter}
          onToggleBuilder={() => setBuildFilter((value) => !value)}
          preview={segmentQuery.data}
        />
      ) : null}

      {step === "content" ? (
        <CampaignBuilder
          initialDocument={form.content ?? BLANK_DOC}
          onChange={(doc) => patch({ content: doc })}
        />
      ) : null}

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send to {segmentQuery.data?.eligible.length ?? 0} people now?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              The recipient list is frozen when sending starts. Pause or cancel from this page if
              something looks wrong.
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void sendNow()}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Send a test email</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <FormField
              label="Recipients"
              htmlFor="campaign-test-recipients"
              hint="Up to 5 active users of this install, comma separated."
            >
              <Input
                id="campaign-test-recipients"
                data-testid="campaign-test-recipients"
                value={testRecipients}
                onChange={(event) => setTestRecipients(event.target.value)}
                placeholder="you@example.com"
              />
            </FormField>
            <FormField label="Sample person" htmlFor="campaign-test-person">
              <Select
                ariaLabel="Sample person"
                testId="campaign-test-person"
                value={testPersonId}
                onChange={setTestPersonId}
                options={(segmentQuery.data?.eligible ?? []).map((person) => ({
                  value: person.id,
                  label: `${person.name} <${person.email}>`,
                }))}
                placeholder="Choose a person"
              />
            </FormField>
            <TestSendMessage message={testMessage} sent={testSent} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTestOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              data-testid="campaign-test-send"
              disabled={testPersonId === "" || testRecipients.trim() === ""}
              onClick={() => void sendTest()}
            >
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Schedule this campaign</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <FormField label="Date" htmlFor="schedule-date">
              <DatePicker value={scheduleDate} onChange={setScheduleDate} ariaLabel="Send date" />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Hour" htmlFor="schedule-hour">
                <Select
                  ariaLabel="Send hour"
                  value={scheduleHour}
                  onChange={setScheduleHour}
                  options={Array.from({ length: 24 }, (_, hour) => ({
                    value: String(hour).padStart(2, "0"),
                    label: `${String(hour).padStart(2, "0")}:00`,
                  }))}
                />
              </FormField>
              <FormField label="Minute" htmlFor="schedule-minute">
                <Select
                  ariaLabel="Send minute"
                  value={scheduleMinute}
                  onChange={setScheduleMinute}
                  options={["00", "15", "30", "45"].map((minute) => ({
                    value: minute,
                    label: minute,
                  }))}
                />
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={scheduleDate === null} onClick={() => void schedule()}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "review" ? (
        <ReviewStep
          items={checklist}
          status={status}
          recipientCount={segmentQuery.data?.eligible.length ?? 0}
          onSend={() => setConfirmSend(true)}
          onSchedule={() => setScheduleOpen(true)}
        />
      ) : null}
    </main>
  );
}

function DetailsStep({
  form,
  patch,
  senders,
  suggestions,
  onSuggest,
  onPick,
}: {
  form: EditorFormState;
  patch: (next: Partial<EditorFormState>) => void;
  senders: { id: string; fromName: string; fromEmail: string; verified: boolean }[];
  suggestions: string[];
  onSuggest: () => void;
  onPick: (subject: string) => void;
}): React.ReactNode {
  return (
    <section className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <FormField label="Name" htmlFor="campaign-name" required>
        <Input
          id="campaign-name"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </FormField>
      <FormField label="Type" htmlFor="campaign-type">
        <Select
          ariaLabel="Campaign type"
          value={form.type}
          onChange={(value) => patch({ type: value as CampaignType })}
          options={CAMPAIGN_TYPES.map((value) => ({ value, label: CAMPAIGN_TYPE_LABELS[value] }))}
        />
      </FormField>
      <FormField
        label="Sender"
        htmlFor="campaign-sender"
        hint={
          <a href="/settings/campaigns" className="text-link-record hover:underline">
            Add a sender
          </a>
        }
      >
        <Select
          ariaLabel="Sender"
          testId="campaign-sender"
          value={form.senderId ?? ""}
          onChange={(value) => patch({ senderId: value === "" ? null : value })}
          options={senders.map((sender) => ({
            value: sender.id,
            label: `${sender.fromName} <${sender.fromEmail}>${sender.verified ? "" : " (unverified)"}`,
          }))}
          placeholder="Choose a sender"
        />
      </FormField>
      <FormField label="Subject" htmlFor="campaign-subject" required span="full">
        <div className="flex gap-2">
          <Input
            id="campaign-subject"
            value={form.subject}
            maxLength={200}
            onChange={(event) => patch({ subject: event.target.value })}
          />
          <Button type="button" variant="outline" onClick={onSuggest}>
            Suggest with AI
          </Button>
        </div>
      </FormField>
      {suggestions.length === 0 ? null : (
        <ul className="space-y-1 sm:col-span-2">
          {suggestions.map((subject) => (
            <li key={subject}>
              <button
                type="button"
                className="text-left text-sm text-link-record hover:underline"
                onClick={() => onPick(subject)}
              >
                {subject}
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormField label="Preview line" htmlFor="campaign-preheader" span="full">
        <Input
          id="campaign-preheader"
          value={form.preheader}
          maxLength={140}
          onChange={(event) => patch({ preheader: event.target.value })}
        />
      </FormField>
      <FormField label="Reply-to" htmlFor="campaign-reply-to">
        <Input
          id="campaign-reply-to"
          type="email"
          value={form.replyTo}
          onChange={(event) => patch({ replyTo: event.target.value })}
        />
      </FormField>
      <div className="rounded-lg border bg-card p-3 sm:col-span-2">
        <p className="text-xs text-muted-foreground">Inbox preview</p>
        <p className="text-sm font-medium">{form.subject === "" ? "(no subject)" : form.subject}</p>
        <p className="text-sm text-muted-foreground">{form.preheader}</p>
      </div>
    </section>
  );
}

function RecipientsStep({
  form,
  patch,
  buildFilter,
  onToggleBuilder,
  preview,
}: {
  form: EditorFormState;
  patch: (next: Partial<EditorFormState>) => void;
  buildFilter: boolean;
  onToggleBuilder: () => void;
  preview: SegmentPreview | undefined;
}): React.ReactNode {
  const savedFilters = trpc.savedFilters.listByTarget.useQuery({ targetEntity: "person" });
  const exclusions = preview?.exclusions;
  return (
    <section className="max-w-3xl space-y-4">
      <FormField label="Saved filter" htmlFor="campaign-saved-filter">
        <Select
          ariaLabel="Saved people filter"
          testId="campaign-saved-filter"
          value={form.segment?.kind === "saved_filter" ? form.segment.savedFilterId : ""}
          onChange={(value) =>
            patch({
              segment: value === "" ? null : { kind: "saved_filter", savedFilterId: value },
            })
          }
          options={(savedFilters.data ?? []).map((view) => ({ value: view.id, label: view.name }))}
          placeholder="Use a saved filter"
        />
      </FormField>
      <Button type="button" variant="outline" size="sm" onClick={onToggleBuilder}>
        {buildFilter ? "Hide filter builder" : "Build a filter"}
      </Button>
      {buildFilter ? (
        <ContactFilterBuilder
          config={PERSON_FILTER_CONFIG}
          fieldLabels={PERSON_FILTER_LABELS}
          activeCount={
            form.segment?.kind === "definition" ? form.segment.definition.conditions.length : 0
          }
          appliedDefinition={form.segment?.kind === "definition" ? form.segment.definition : null}
          onApply={(definition) =>
            patch({
              segment: definition === null ? null : { kind: "definition", definition },
            })
          }
        />
      ) : null}

      {form.segment === null ? (
        <p className="text-sm text-muted-foreground">
          Choose a filter to see who will receive this campaign.
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p>
            <strong>{preview?.eligible.length ?? 0}</strong>{" "}
            {(preview?.eligible.length ?? 0) === 1 ? "person" : "people"} will receive this
            campaign.
          </p>
          {exclusions === undefined ? null : (
            <p className="text-muted-foreground">
              Excluded: {exclusions.notSubscribed} not subscribed, {exclusions.pending} pending,{" "}
              {exclusions.unsubscribed} unsubscribed, {exclusions.bounced} bounced,{" "}
              {exclusions.suppressed} suppressed, {exclusions.noEmail} without email,{" "}
              {exclusions.duplicateEmail} duplicate.
            </p>
          )}
          {(preview?.eligible.length ?? 0) === 0 ? null : (
            <details>
              <summary className="cursor-pointer text-sm">Preview recipients (first 50)</summary>
              <ul className="mt-2 divide-y">
                {(preview?.eligible ?? []).slice(0, 50).map((person) => (
                  <li key={person.id} className="py-1">
                    {person.name} <span className="text-muted-foreground">{person.email}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewStep({
  items,
  status,
  recipientCount,
  onSend,
  onSchedule,
}: {
  items: ChecklistItem[];
  status: string;
  recipientCount: number;
  onSend: () => void;
  onSchedule: () => void;
}): React.ReactNode {
  const blocked = items.some((item) => item.status === "fail") || recipientCount === 0;
  return (
    <section className="max-w-2xl space-y-3">
      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <Badge
              variant={
                item.status === "pass"
                  ? "success"
                  : item.status === "fail"
                    ? "destructive"
                    : "secondary"
              }
            >
              {item.status}
            </Badge>
            <span className="flex-1">{item.label}</span>
            {item.detail === undefined ? null : (
              <span className="text-xs text-muted-foreground">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>
      {status === "draft" ? (
        <div className="flex gap-2">
          <Button type="button" data-testid="campaign-send-now" disabled={blocked} onClick={onSend}>
            Send now
          </Button>
          <Button type="button" variant="outline" disabled={blocked} onClick={onSchedule}>
            Schedule
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This campaign is {status}.</p>
      )}
    </section>
  );
}
