"use client";

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
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { DOCUMENT_VARIABLE_KEYS, DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import {
  createDocumentTemplateAction,
  updateDocumentTemplateAction,
} from "@/features/documents/actions";
import type { DocKind } from "@/features/documents/transitions";
import { renderVariables } from "@/features/documents/variables";
import { readCsrfToken } from "@/utils/csrfCookie";
import { MarkdownLite } from "./MarkdownLite";

const S = DOCUMENTS_STRINGS;

export interface TemplateFormValues {
  id: string;
  name: string;
  body: string;
  terms: string | null;
  includeProducts: boolean;
}

interface Props {
  open: boolean;
  kind: DocKind;
  template: TemplateFormValues | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  body: string;
  terms: string;
  includeProducts: boolean;
}

// Samples so the live preview reads like a real document instead of a wall of
// braces. The template itself still stores the variables.
const SAMPLE = {
  "deal.title": "Acme renewal",
  "deal.value": "$12,000.00",
  "person.name": "Ada Lovelace",
  "person.first_name": "Ada",
  "organization.name": "Analytical Engines",
  "owner.name": "Sam Taylor",
  "owner.email": "sam@example.com",
  "company.name": "Northwind Advisory",
  "document.title": "Quote for Acme renewal",
  "document.number": "Q-2026-0001",
  "document.total": "$12,000.00",
  "document.valid_until": "20 November 2026",
  "document.due_date": "3 November 2026",
  "document.issue_date": "21 October 2026",
};

function initialState(template: TemplateFormValues | null): FormState {
  if (template === null) {
    return { name: "", body: "", terms: "", includeProducts: true };
  }
  return {
    name: template.name,
    body: template.body,
    terms: template.terms ?? "",
    includeProducts: template.includeProducts,
  };
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.DOC_TEMPLATE_NOT_FOUND:
      return S.errors.templateNotFound;
    case ERROR_IDS.DOC_LAST_TEMPLATE:
      return S.errors.lastTemplate;
    case ERROR_IDS.DOC_INPUT_INVALID:
      return S.errors.invalid;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.saveFailed;
  }
}

export function TemplateDialog({
  open,
  kind,
  template,
  onOpenChange,
  onSaved,
}: Props): React.ReactNode {
  const [form, setForm] = useState<FormState>(() => initialState(template));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(): Promise<void> {
    setPending(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      body: form.body,
      terms: form.terms.trim() === "" ? null : form.terms,
      includeProducts: form.includeProducts,
    };
    const result =
      template === null
        ? await createDocumentTemplateAction({ ...payload, kind }, readCsrfToken())
        : await updateDocumentTemplateAction({ ...payload, id: template.id }, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    onSaved();
    onOpenChange(false);
  }

  const previewSource =
    form.terms.trim() === "" ? form.body : `${form.body}\n\n## Terms\n${form.terms.trim()}`;
  const preview = renderVariables(previewSource, SAMPLE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        data-testid="document-template-dialog"
      >
        <DialogHeader>
          <DialogTitle>{template === null ? S.newTemplate : S.editTemplate}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block" htmlFor="document-template-name">
              <span className="mb-1.5 block text-sm font-medium">{S.templateName}</span>
              <Input
                id="document-template-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                autoFocus
              />
            </label>
            <label className="block" htmlFor="document-template-body">
              <span className="mb-1.5 block text-sm font-medium">{S.templateBody}</span>
              <Textarea
                id="document-template-body"
                className="min-h-48 font-mono text-xs"
                value={form.body}
                onChange={(event) => update("body", event.target.value)}
              />
            </label>
            <label className="block" htmlFor="document-template-terms">
              <span className="mb-1.5 block text-sm font-medium">{S.templateTerms}</span>
              <Textarea
                id="document-template-terms"
                className="min-h-20"
                value={form.terms}
                onChange={(event) => update("terms", event.target.value)}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="document-template-products" className="text-sm font-medium">
                {S.includeProducts}
              </label>
              <Switch
                id="document-template-products"
                label={S.includeProducts}
                checked={form.includeProducts}
                onCheckedChange={(checked) => update("includeProducts", checked)}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">{S.variables}</p>
              <p className="mb-2 text-xs text-muted-foreground">{S.variablesHelp}</p>
              <div className="flex flex-wrap gap-1.5">
                {DOCUMENT_VARIABLE_KEYS.map((key) => (
                  <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {`{{${key}}}`}
                  </code>
                ))}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{products}}"}</code>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {S.preview}
            </p>
            <div data-testid="document-template-preview">
              <MarkdownLite source={preview} />
            </div>
          </div>
        </div>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {S.cancel}
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
            {pending ? S.saving : S.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
