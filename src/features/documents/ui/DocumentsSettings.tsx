"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import {
  SETTINGS_TABLE_CELL,
  SETTINGS_TABLE_HEAD,
  SETTINGS_TABLE_HEADER_CELL,
  SETTINGS_TABLE_ROW,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
} from "@/app/(app)/settings/SettingsSurface";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import {
  deleteDocumentTemplateAction,
  setDefaultDocumentTemplateAction,
  updateDocumentSettingsAction,
} from "@/features/documents/actions";
import type { DocumentSettingsView } from "@/features/documents/settings";
import type { DocumentTemplateView } from "@/features/documents/templates";
import type { DocKind } from "@/features/documents/transitions";
import { cn } from "@/lib/utils";
import { readCsrfToken } from "@/utils/csrfCookie";
import { TemplateDialog, type TemplateFormValues } from "./TemplateDialog";

const S = DOCUMENTS_STRINGS;

interface Props {
  settings: DocumentSettingsView;
  templates: Record<DocKind, DocumentTemplateView[]>;
}

interface FormState {
  quotePrefix: string;
  invoicePrefix: string;
  quoteValidDays: string;
  invoiceDueDays: string;
  companyName: string;
  companyAddress: string;
  companyTaxId: string;
  paymentInstructions: string;
  footer: string;
}

const PREFIX = /^[A-Z0-9]{1,8}$/;

function initialState(settings: DocumentSettingsView): FormState {
  return {
    quotePrefix: settings.quotePrefix,
    invoicePrefix: settings.invoicePrefix,
    quoteValidDays: String(settings.quoteValidDays),
    invoiceDueDays: String(settings.invoiceDueDays),
    companyName: settings.companyName ?? "",
    companyAddress: settings.companyAddress ?? "",
    companyTaxId: settings.companyTaxId ?? "",
    paymentInstructions: settings.paymentInstructions ?? "",
    footer: settings.footer ?? "",
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function days(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) return null;
  return parsed;
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.DOC_INPUT_INVALID:
      return S.errors.invalid;
    case ERROR_IDS.DOC_LAST_TEMPLATE:
      return S.errors.lastTemplate;
    case ERROR_IDS.DOC_TEMPLATE_NOT_FOUND:
      return S.errors.templateNotFound;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.saveFailed;
  }
}

export function DocumentsSettings({ settings, templates }: Props): React.ReactNode {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(settings));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [dialogKind, setDialogKind] = useState<DocKind | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [editing, setEditing] = useState<TemplateFormValues | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentTemplateView | null>(null);
  const [templatePending, setTemplatePending] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function saveSettings(): Promise<void> {
    setError(null);
    setSaved(false);
    const quoteValidDays = days(form.quoteValidDays);
    const invoiceDueDays = days(form.invoiceDueDays);
    if (quoteValidDays === null || invoiceDueDays === null) {
      setError(S.daysInvalid);
      return;
    }
    const quotePrefix = form.quotePrefix.trim().toUpperCase();
    const invoicePrefix = form.invoicePrefix.trim().toUpperCase();
    if (!PREFIX.test(quotePrefix) || !PREFIX.test(invoicePrefix)) {
      setError(S.prefixInvalid);
      return;
    }
    setPending(true);
    const result = await updateDocumentSettingsAction(
      {
        quotePrefix,
        invoicePrefix,
        quoteValidDays,
        invoiceDueDays,
        companyName: emptyToNull(form.companyName),
        companyAddress: emptyToNull(form.companyAddress),
        companyTaxId: emptyToNull(form.companyTaxId),
        paymentInstructions: emptyToNull(form.paymentInstructions),
        footer: emptyToNull(form.footer),
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    setSaved(true);
    router.refresh();
  }

  function openNew(kind: DocKind): void {
    setEditing(null);
    setDialogKind(kind);
    setDialogKey((current) => current + 1);
  }

  function openEdit(template: DocumentTemplateView): void {
    setEditing({
      id: template.id,
      name: template.name,
      body: template.body,
      terms: template.terms,
      includeProducts: template.includeProducts,
    });
    setDialogKind(template.kind);
    setDialogKey((current) => current + 1);
  }

  async function makeDefault(template: DocumentTemplateView): Promise<void> {
    setTemplatePending(true);
    setError(null);
    const result = await setDefaultDocumentTemplateAction(template.id, readCsrfToken());
    setTemplatePending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    router.refresh();
  }

  async function removeTemplate(): Promise<void> {
    if (pendingDelete === null) return;
    setTemplatePending(true);
    setError(null);
    const result = await deleteDocumentTemplateAction(pendingDelete.id, readCsrfToken());
    setTemplatePending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        data-testid="documents-settings-form"
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveSettings();
        }}
      >
        <SettingsCard>
          <SettingsCardHeader title={S.numbering} description={S.numberingDescription} />
          <SettingsCardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block" htmlFor="document-quote-prefix">
                <span className="mb-1.5 block text-sm font-medium">{S.quotePrefix}</span>
                <Input
                  id="document-quote-prefix"
                  value={form.quotePrefix}
                  maxLength={8}
                  onChange={(event) => update("quotePrefix", event.target.value.toUpperCase())}
                />
              </label>
              <label className="block" htmlFor="document-invoice-prefix">
                <span className="mb-1.5 block text-sm font-medium">{S.invoicePrefix}</span>
                <Input
                  id="document-invoice-prefix"
                  value={form.invoicePrefix}
                  maxLength={8}
                  onChange={(event) => update("invoicePrefix", event.target.value.toUpperCase())}
                />
              </label>
              <label className="block" htmlFor="document-quote-days">
                <span className="mb-1.5 block text-sm font-medium">{S.quoteValidDays}</span>
                <Input
                  id="document-quote-days"
                  inputMode="numeric"
                  value={form.quoteValidDays}
                  onChange={(event) => update("quoteValidDays", event.target.value)}
                />
              </label>
              <label className="block" htmlFor="document-invoice-days">
                <span className="mb-1.5 block text-sm font-medium">{S.invoiceDueDays}</span>
                <Input
                  id="document-invoice-days"
                  inputMode="numeric"
                  value={form.invoiceDueDays}
                  onChange={(event) => update("invoiceDueDays", event.target.value)}
                />
              </label>
            </div>
          </SettingsCardBody>
        </SettingsCard>

        <SettingsCard>
          <SettingsCardHeader title={S.company} description={S.companyDescription} />
          <SettingsCardBody>
            <div className="space-y-4">
              <label className="block" htmlFor="document-company-name">
                <span className="mb-1.5 block text-sm font-medium">{S.companyName}</span>
                <Input
                  id="document-company-name"
                  value={form.companyName}
                  onChange={(event) => update("companyName", event.target.value)}
                />
              </label>
              <label className="block" htmlFor="document-company-address">
                <span className="mb-1.5 block text-sm font-medium">{S.companyAddress}</span>
                <Textarea
                  id="document-company-address"
                  value={form.companyAddress}
                  onChange={(event) => update("companyAddress", event.target.value)}
                />
              </label>
              <label className="block" htmlFor="document-company-tax-id">
                <span className="mb-1.5 block text-sm font-medium">{S.companyTaxId}</span>
                <Input
                  id="document-company-tax-id"
                  value={form.companyTaxId}
                  onChange={(event) => update("companyTaxId", event.target.value)}
                />
              </label>
            </div>
          </SettingsCardBody>
        </SettingsCard>

        <SettingsCard>
          <SettingsCardHeader title={S.payment} description={S.paymentDescription} />
          <SettingsCardBody>
            <div className="space-y-4">
              <label className="block" htmlFor="document-payment-instructions">
                <span className="mb-1.5 block text-sm font-medium">{S.paymentInstructions}</span>
                <Textarea
                  id="document-payment-instructions"
                  value={form.paymentInstructions}
                  onChange={(event) => update("paymentInstructions", event.target.value)}
                />
              </label>
              <label className="block" htmlFor="document-footer">
                <span className="mb-1.5 block text-sm font-medium">{S.footer}</span>
                <Textarea
                  id="document-footer"
                  value={form.footer}
                  onChange={(event) => update("footer", event.target.value)}
                />
              </label>
            </div>
          </SettingsCardBody>
        </SettingsCard>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? S.saving : S.save}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">{S.saved}</span>}
        </div>
      </form>

      <SettingsCard>
        <SettingsCardHeader title={S.templates} description={S.templatesDescription} />
        <SettingsCardBody>
          <div className="space-y-8">
            {(["quote", "invoice"] as const).map((kind) => (
              <section key={kind} aria-label={kind === "quote" ? S.quotes : S.invoices}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    {kind === "quote" ? S.quotes : S.invoices}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={templatePending}
                    onClick={() => openNew(kind)}
                  >
                    {S.newTemplate}
                  </Button>
                </div>
                {templates[kind].length === 0 ? (
                  <p className="text-sm text-muted-foreground">{S.templatesEmpty}</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className={SETTINGS_TABLE_HEAD}>
                      <tr>
                        <th className={SETTINGS_TABLE_HEADER_CELL}>{S.templateName}</th>
                        <th className={SETTINGS_TABLE_HEADER_CELL}>{S.defaultBadge}</th>
                        <th className={cn(SETTINGS_TABLE_HEADER_CELL, "text-right")}>{S.edit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates[kind].map((template) => (
                        <tr
                          key={template.id}
                          data-testid="document-template-row"
                          data-template-id={template.id}
                          data-kind={kind}
                          className={SETTINGS_TABLE_ROW}
                        >
                          <td className={SETTINGS_TABLE_CELL}>{template.name}</td>
                          <td className={SETTINGS_TABLE_CELL}>
                            {template.isDefault ? (
                              <Badge variant="secondary">{S.defaultBadge}</Badge>
                            ) : null}
                          </td>
                          <td className={cn(SETTINGS_TABLE_CELL, "text-right")}>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(template)}
                              >
                                {S.edit}
                              </Button>
                              {!template.isDefault && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={templatePending}
                                  onClick={() => void makeDefault(template)}
                                >
                                  {S.setDefault}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={templatePending}
                                onClick={() => setPendingDelete(template)}
                              >
                                {S.delete}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>
        </SettingsCardBody>
      </SettingsCard>

      {dialogKind !== null && (
        <TemplateDialog
          key={dialogKey}
          open
          kind={dialogKind}
          template={editing}
          onOpenChange={(open) => {
            if (!open) setDialogKind(null);
          }}
          onSaved={() => {
            setError(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={S.deleteTitle}
        description={S.deleteDescription}
        confirmLabel={S.deleteConfirm}
        cancelLabel={S.cancel}
        destructive
        pending={templatePending}
        onConfirm={() => void removeTemplate()}
      />
    </div>
  );
}
