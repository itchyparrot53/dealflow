"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import {
  createDocumentAction,
  deleteDraftAction,
  deletePaymentAction,
  duplicateDocumentAction,
  issueDocumentAction,
  refreshDocumentLinesAction,
  updateDraftAction,
  voidInvoiceAction,
} from "@/features/documents/actions";
import type { DocumentView as DocumentRecord } from "@/features/documents/documents";
import { nextStatus } from "@/features/documents/transitions";
import { renderDocumentBody } from "@/features/documents/variables";
import { cn } from "@/lib/utils";
import { readCsrfToken } from "@/utils/csrfCookie";
import { DocumentView, type DocumentViewCompany, longDate } from "./DocumentView";
import { PaymentDialog } from "./PaymentDialog";
import { SendDialog } from "./SendDialog";

const S = DOCUMENTS_STRINGS;

const STATUS_LABEL: Record<DocumentRecord["status"], string> = {
  draft: S.statusDraft,
  sent: S.statusSent,
  viewed: S.statusViewed,
  accepted: S.statusAccepted,
  declined: S.statusDeclined,
  overdue: S.statusOverdue,
  paid: S.statusPaid,
  void: S.statusVoid,
};

function statusVariant(status: DocumentRecord["status"]): BadgeProps["variant"] {
  switch (status) {
    case "accepted":
    case "paid":
      return "success";
    case "declined":
    case "void":
    case "overdue":
      return "destructive";
    case "sent":
    case "viewed":
      return "secondary";
    case "draft":
      return "outline";
  }
}

function errorText(id: string, status: DocumentRecord["status"]): string {
  switch (id) {
    case ERROR_IDS.DOC_IMMUTABLE:
      return S.errors.immutable;
    case ERROR_IDS.DOC_TRANSITION:
      return S.errors.transition(STATUS_LABEL[status]);
    case ERROR_IDS.DOC_INVOICE_DELETE:
      return S.errors.invoiceDelete;
    case ERROR_IDS.DOC_OVERPAYMENT:
      return S.errors.overpayment;
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

interface Props {
  document: DocumentRecord;
  company: DocumentViewCompany;
  paymentInstructions: string | null;
  footer: string | null;
}

export function DocumentEditor({
  document,
  company,
  paymentInstructions,
  footer,
}: Props): React.ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState(document.title);
  const [body, setBody] = useState(document.body);
  const [validUntil, setValidUntil] = useState<string | null>(document.validUntil);
  const [dueDate, setDueDate] = useState<string | null>(document.dueDate);
  const [customerName, setCustomerName] = useState(document.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(document.customerEmail ?? "");
  const [customerAddress, setCustomerAddress] = useState(document.customerAddress ?? "");

  const [sendOpen, setSendOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const draft = document.status === "draft";
  const isInvoice = document.kind === "invoice";

  async function run<T>(
    action: () => Promise<{ ok: true; value: T } | { ok: false; error: { id: string } }>,
    onOk: (value: T) => void,
  ): Promise<void> {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id, document.status));
      return;
    }
    onOk(result.value);
  }

  function refresh(): void {
    router.refresh();
  }

  async function saveDraft(): Promise<void> {
    await run(
      () =>
        updateDraftAction(
          {
            id: document.id,
            title: title.trim(),
            body,
            validUntil,
            dueDate,
            customerName: customerName.trim() === "" ? null : customerName.trim(),
            customerEmail: customerEmail.trim() === "" ? null : customerEmail.trim(),
            customerAddress: customerAddress.trim() === "" ? null : customerAddress.trim(),
          },
          readCsrfToken(),
        ),
      () => {
        setSaved(true);
        refresh();
      },
    );
  }

  async function issue(via: "issue" | "markSent"): Promise<void> {
    await run(() => issueDocumentAction(document.id, via, readCsrfToken()), refresh);
  }

  async function duplicate(): Promise<void> {
    await run(
      () => duplicateDocumentAction(document.id, readCsrfToken()),
      (copy) => {
        router.push(`/documents/${copy.id}`);
      },
    );
  }

  async function removeDraft(): Promise<void> {
    await run(
      () => deleteDraftAction(document.id, readCsrfToken()),
      () => {
        router.push("/documents");
      },
    );
  }

  async function removePayment(paymentId: string): Promise<void> {
    await run(() => deletePaymentAction(paymentId, readCsrfToken()), refresh);
  }

  async function createInvoice(): Promise<void> {
    await run(
      () =>
        createDocumentAction(
          { dealId: document.dealId, kind: "invoice", sourceQuoteId: document.id },
          readCsrfToken(),
        ),
      (invoice) => {
        router.push(`/documents/${invoice.id}`);
      },
    );
  }

  async function refreshLines(): Promise<void> {
    await run(() => refreshDocumentLinesAction(document.id, readCsrfToken()), refresh);
  }

  async function issueVoid(): Promise<void> {
    await run(() => voidInvoiceAction(document.id, readCsrfToken()), refresh);
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(document.publicUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const canIssue = nextStatus(document.kind, document.status, "issue") !== null;
  const canMarkSent = nextStatus(document.kind, document.status, "markSent") !== null;
  const canVoid = nextStatus(document.kind, document.status, "void") !== null;
  const canPay = isInvoice && nextStatus(document.kind, document.status, "pay") !== null;

  // A draft previews what the form currently says; an issued document is immutable.
  const previewTitle = draft ? title : document.title;
  const previewBody = renderDocumentBody(draft ? body : document.body, document);

  const PAPER_PANEL_CLASS = "rounded-md border bg-white p-4 text-neutral-900"; // design-ok: paper panel

  const previewDocument = {
    kind: document.kind,
    number: document.number,
    title: previewTitle,
    body: previewBody,
    currency: document.currency,
    subtotal: document.subtotal,
    tax: document.tax,
    total: document.total,
    status: document.status,
    customerName: draft ? (customerName === "" ? null : customerName) : document.customerName,
    customerAddress: draft
      ? customerAddress === ""
        ? null
        : customerAddress
      : document.customerAddress,
    issueDate: document.issueDate,
    validUntil: draft ? validUntil : document.validUntil,
    dueDate: draft ? dueDate : document.dueDate,
    paidAt: document.paidAt,
    outstanding: document.outstanding,
    lines: document.lines,
    company,
    paymentInstructions,
    footer,
  };

  // The action hierarchy is its own function so the editor component stays readable (and under
  // the cognitive-complexity budget).
  const renderActions = (): React.ReactNode => (
    <div className="flex flex-wrap items-center gap-2" data-print-hide>
      {draft ? (
        <>
          {/* 6.7.5: Send is the one filled action for a draft. */}
          <Button
            type="button"
            size="sm"
            data-testid="document-send"
            disabled={pending}
            onClick={() => setSendOpen(true)}
          >
            {S.send}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="document-save-draft"
            disabled={pending}
            onClick={() => void saveDraft()}
          >
            {S.saveDraft}
          </Button>
          {canIssue && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="document-issue"
              disabled={pending}
              onClick={() => void issue("issue")}
            >
              {S.issue}
            </Button>
          )}
          {canMarkSent && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="document-mark-sent"
              disabled={pending}
              onClick={() => void issue("markSent")}
            >
              {S.markSent}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="document-copy-link"
            data-public-url={document.publicUrl}
            disabled={pending}
            onClick={() => void copyLink()}
          >
            {copied ? S.copied : S.copyLink}
          </Button>
          <Link
            href={`/documents/${document.id}/print`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {S.printPreview}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" aria-label="More actions">
                <Ellipsis aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="document-delete-draft"
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                {S.deleteDraft}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            data-testid="document-send"
            disabled={pending}
            onClick={() => setSendOpen(true)}
          >
            {S.sendAgain}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="document-copy-link"
            data-public-url={document.publicUrl}
            disabled={pending}
            onClick={() => void copyLink()}
          >
            {copied ? S.copied : S.copyLink}
          </Button>
          {document.status === "accepted" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="document-create-invoice"
              disabled={pending}
              onClick={() => void createInvoice()}
            >
              {S.createInvoice}
            </Button>
          )}
          {canPay && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="document-record-payment"
              disabled={pending}
              onClick={() => setPaymentOpen(true)}
            >
              {S.recordPayment}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void duplicate()}
          >
            {S.duplicate}
          </Button>
          <Link
            href={`/documents/${document.id}/print`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {S.printPreview}
          </Link>
          {canVoid && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="More actions">
                  <Ellipsis aria-hidden="true" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  data-testid="document-void"
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setVoidOpen(true)}
                >
                  {S.voidInvoice}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-6" data-testid="document-editor">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-title">{previewTitle}</h1>
            <Badge variant={statusVariant(document.status)} data-testid="document-status">
              {STATUS_LABEL[document.status]}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {document.number ?? S.statusDraft}
            </span>
            <span className="text-sm">
              {document.total} {document.currency}
            </span>
            {isInvoice && (
              <span className="text-sm text-muted-foreground" data-testid="document-outstanding">
                {S.outstanding}: {document.outstanding} {document.currency}
              </span>
            )}
          </div>
        </div>
        {renderActions()}
      </header>

      {draft && (
        <section className="rounded-lg border bg-card p-4" data-print-hide>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <FormGrid columns={2}>
                <FormField label={S.documentTitle} htmlFor="document-title" span="full">
                  <Input
                    id="document-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={pending}
                  />
                </FormField>
                {!isInvoice && (
                  <FormField label={S.validUntil}>
                    <DatePicker
                      value={validUntil}
                      onChange={setValidUntil}
                      ariaLabel={S.validUntil}
                      placeholder={S.validUntil}
                    />
                  </FormField>
                )}
                {isInvoice && (
                  <FormField label={S.dueDate}>
                    <DatePicker
                      value={dueDate}
                      onChange={setDueDate}
                      ariaLabel={S.dueDate}
                      placeholder={S.dueDate}
                    />
                  </FormField>
                )}
                <FormField label={S.customerName} htmlFor="document-customer-name">
                  <Input
                    id="document-customer-name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    disabled={pending}
                  />
                </FormField>
                <FormField label={S.customerEmail} htmlFor="document-customer-email">
                  <Input
                    id="document-customer-email"
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    disabled={pending}
                  />
                </FormField>
                <FormField
                  label={S.customerAddress}
                  htmlFor="document-customer-address"
                  span="full"
                >
                  <Textarea
                    id="document-customer-address"
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    disabled={pending}
                  />
                </FormField>
                <FormField
                  label="Template text"
                  htmlFor="document-body"
                  hint="Use {{variables}} from the list. The preview updates as you type."
                  span="full"
                >
                  <Textarea
                    id="document-body"
                    className="min-h-48 font-mono text-xs"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    disabled={pending}
                  />
                </FormField>
              </FormGrid>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void refreshLines()}
                >
                  {S.refreshFromDeal}
                </Button>
                {saved && <span className="text-sm text-muted-foreground">{S.saved}</span>}
              </div>
            </div>
            {/* 6.7.5: the same renderer as Print preview, on paper in both themes. */}
            <div className={PAPER_PANEL_CLASS}>
              <DocumentView document={previewDocument} />
            </div>
          </div>
        </section>
      )}

      {isInvoice && (
        <section className="rounded-lg border bg-card p-4" data-print-hide>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{S.payments}</h2>
            {canPay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setPaymentOpen(true)}
              >
                {S.recordPayment}
              </Button>
            )}
          </div>
          {document.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{S.noPayments}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 font-medium">{S.amount}</th>
                  <th className="py-2 font-medium">{S.paidOn}</th>
                  <th className="py-2 font-medium">{S.method}</th>
                  <th className="py-2 font-medium">{S.reference}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {document.payments.map((payment) => (
                  <tr key={payment.id} className="border-b">
                    <td className="py-2">
                      {payment.amount} {document.currency}
                    </td>
                    <td className="py-2">{longDate(payment.paidOn)}</td>
                    <td className="py-2">{payment.method}</td>
                    <td className="py-2">{payment.reference ?? ""}</td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => void removePayment(payment.id)}
                      >
                        {S.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {draft ? null : (
        <div className="rounded-lg bg-canvas-subtle p-6">
          <DocumentView document={previewDocument} />
        </div>
      )}

      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        document={{
          id: document.id,
          kind: document.kind,
          status: document.status,
          number: document.number,
          customerEmail: document.customerEmail,
        }}
        onSent={refresh}
      />
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        document={{ id: document.id, outstanding: document.outstanding, status: document.status }}
        onRecorded={refresh}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={S.deleteDraftTitle}
        description={S.deleteDraftDescription}
        confirmLabel={S.delete}
        cancelLabel={S.cancel}
        destructive
        pending={pending}
        onConfirm={() => void removeDraft()}
      />
      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={S.voidTitle}
        description={S.voidDescription}
        confirmLabel={S.voidConfirm}
        cancelLabel={S.cancel}
        destructive
        pending={pending}
        onConfirm={() => void issueVoid()}
      />
    </div>
  );
}
