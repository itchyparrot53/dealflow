"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tip } from "@/components/ui/tooltip";
import { EMAIL_DESIGN_STRINGS } from "@/constants/emailDesignStrings";
import { RichTextBody } from "@/features/email/composer/RichTextBody";
import { useToastStore } from "@/features/feedback/toastStore";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  sendEmailTemplateTestAction,
} from "../actions";
import type { EmailTemplateDef } from "../registry";
import type { ResolvedTemplate } from "../templates";
import { EmailPreview } from "./EmailPreview";

const S = EMAIL_DESIGN_STRINGS.templates;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function insertAtCursor(
  element: HTMLInputElement | null,
  token: string,
  value: string,
  set: (next: string) => void,
): void {
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? value.length;
  set(`${value.slice(0, start)}${token}${value.slice(end)}`);
}

export function TemplateEditor({
  def,
  initial,
  onClose,
  onSaved,
}: {
  def: EmailTemplateDef;
  initial: ResolvedTemplate;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactNode {
  const toast = useToastStore((state) => state.push);
  const [subject, setSubject] = useState(initial.subject);
  const [preheader, setPreheader] = useState(initial.preheader ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial.bodyHtml);
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel ?? "");
  const [insertToken, setInsertToken] = useState<{ text: string; seq: number } | undefined>();
  const [activeField, setActiveField] = useState<"subject" | "preheader" | "body">("body");
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const preheaderRef = useRef<HTMLInputElement>(null);
  const draft = useDebounced({ subject, preheader, bodyHtml, ctaLabel }, 300);
  const preview = trpc.emailDesign.previewTemplate.useQuery(
    {
      key: def.key,
      input: {
        subject: draft.subject,
        preheader: draft.preheader === "" ? null : draft.preheader,
        bodyHtml: draft.bodyHtml,
        ctaLabel: draft.ctaLabel === "" ? null : draft.ctaLabel,
      },
    },
    { refetchOnWindowFocus: false },
  );

  function insert(name: string): void {
    const token = `{{${name}}}`;
    if (activeField === "body") {
      setInsertToken((current) => ({ text: token, seq: (current?.seq ?? 0) + 1 }));
      return;
    }
    if (activeField === "subject") {
      insertAtCursor(subjectRef.current, token, subject, setSubject);
      return;
    }
    insertAtCursor(preheaderRef.current, token, preheader, setPreheader);
  }

  async function save(): Promise<void> {
    setPending(true);
    const result = await saveEmailTemplateAction(
      def.key,
      {
        subject,
        preheader: preheader === "" ? null : preheader,
        bodyHtml,
        ctaLabel: ctaLabel === "" ? null : ctaLabel,
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!result.ok) {
      toast({ message: S.saveFailed, tone: "error" });
      return;
    }
    toast({ message: S.saved });
    onSaved();
  }

  async function reset(): Promise<void> {
    setPending(true);
    const result = await resetEmailTemplateAction(def.key, readCsrfToken());
    setPending(false);
    setConfirmReset(false);
    if (!result.ok) {
      toast({ message: S.saveFailed, tone: "error" });
      return;
    }
    setSubject(result.value.subject);
    setPreheader(result.value.preheader ?? "");
    setBodyHtml(result.value.bodyHtml);
    setCtaLabel(result.value.ctaLabel ?? "");
    toast({ message: S.resetDone });
    onSaved();
  }

  async function sendTest(): Promise<void> {
    const result = await sendEmailTemplateTestAction(def.key, readCsrfToken());
    if (!result.ok) {
      toast({ message: S.saveFailed, tone: "error" });
      return;
    }
    toast({ message: EMAIL_DESIGN_STRINGS.branding.testSent });
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent closeButton="header" className="w-full sm:max-w-[1100px]">
        <SheetHeader>
          <SheetTitle>{S.editorTitle.replace("{name}", def.name)}</SheetTitle>
          <p className="text-sm text-muted-foreground">{def.description}</p>
        </SheetHeader>
        <SheetBody className="p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
            <div className="space-y-4">
              <FormField label={S.subject}>
                <Input
                  ref={subjectRef}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  onFocus={() => setActiveField("subject")}
                  maxLength={200}
                />
              </FormField>
              <FormField label={S.preheader}>
                <Input
                  ref={preheaderRef}
                  value={preheader}
                  onChange={(event) => setPreheader(event.target.value)}
                  onFocus={() => setActiveField("preheader")}
                  maxLength={140}
                />
              </FormField>
              <div>
                <span className="mb-1.5 block text-sm font-medium">{S.body}</span>
                <RichTextBody
                  html={bodyHtml}
                  onChange={setBodyHtml}
                  insertToken={insertToken}
                  ariaLabel={S.body}
                  onFocus={() => setActiveField("body")}
                  frameClassName="rounded-md border bg-card"
                />
              </div>
              {def.cta !== undefined && (
                <FormField label={S.buttonLabel}>
                  <Input
                    value={ctaLabel}
                    onChange={(event) => setCtaLabel(event.target.value)}
                    maxLength={40}
                  />
                </FormField>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">{S.variables}</p>
                <Combobox
                  ariaLabel={S.insertVariable}
                  value=""
                  onChange={(name) => {
                    if (name !== "") insert(name);
                  }}
                  options={def.variables.map((variable) => ({
                    value: variable.name,
                    label: `{{${variable.name}}}`,
                  }))}
                  placeholder={S.insertVariable}
                  triggerClassName="h-8 w-full"
                />
                <div className="flex flex-wrap gap-1.5">
                  {def.variables.map((variable) => (
                    <Tip key={variable.name} label={variable.description}>
                      <button
                        type="button"
                        onClick={() => insert(variable.name)}
                        className="rounded-md border px-1.5 py-0.5 font-mono text-meta text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {`{{${variable.name}}}`}
                      </button>
                    </Tip>
                  ))}
                </div>
              </div>
            </div>
            <div className="xl:sticky xl:top-0 xl:self-start">
              <h3 className="mb-2 text-sm font-medium">{S.preview}</h3>
              {preview.data === undefined ? (
                <div className="h-[560px] animate-pulse rounded-lg border bg-canvas-subtle" />
              ) : (
                <EmailPreview html={preview.data.html} />
              )}
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              {S.reset}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void sendTest()}>
                {S.sendTest}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" size="sm" loading={pending} onClick={() => void save()}>
                {S.save}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={S.resetTitle}
        description={S.resetBody}
        confirmLabel={S.reset}
        onConfirm={() => void reset()}
      />
    </Sheet>
  );
}
