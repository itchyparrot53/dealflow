"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
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

  return (
    <div className="space-y-6" data-testid="document-editor">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {isInvoice ? "Invoice" : "Quote"}
          </p>
          <h1 className="truncate text-title">{previewTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(document.status)} data-testid="document-status">
              {STATUS_LABEL[document.status]}
            </Badge>
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
        <div className="flex flex-wrap items-center gap-2" data-print-hide>
          {draft && canIssue && (
            <Button
              type="button"
              size="sm"
              data-testid="document-issue"
              disabled={pending}
              onClick={() => void issue("issue")}
            >
              {S.issue}
            </Button>
          )}
          {draft && canMarkSent && (
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
          {!draft && (
            <Button
              type="button"
              size="sm"
              data-testid="document-send"
              disabled={pending}
              onClick={() => setSendOpen(true)}
            >
              {S.sendAgain}
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
          {document.status === "accepted" && (
            <Button
              type="button"
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
          {canVoid && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="document-void"
              disabled={pending}
              onClick={() => setVoidOpen(true)}
            >
              {S.voidInvoice}
            </Button>
          )}
          {!draft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => void duplicate()}
            >
              {S.duplicate}
            </Button>
          )}
          {draft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              {S.deleteDraft}
            </Button>
          )}
          <Link
            href={`/documents/${document.id}/print`}
            target="_blank"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {S.printPreview}
          </Link>
        </div>
      </header>

      {draft && (
        <section className="rounded-lg border bg-card p-4" data-print-hide>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2" htmlFor="document-title">
              <span className="mb-1.5 block text-sm font-medium">{S.documentTitle}</span>
              <Input
                id="document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending}
              />
            </label>
            {!isInvoice && (
              <div className="block">
                <span className="mb-1.5 block text-sm font-medium">{S.validUntil}</span>
                <DatePicker
                  value={validUntil}
                  onChange={setValidUntil}
                  ariaLabel={S.validUntil}
                  placeholder={S.validUntil}
                />
              </div>
            )}
            {isInvoice && (
              <div className="block">
                <span className="mb-1.5 block text-sm font-medium">{S.dueDate}</span>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  ariaLabel={S.dueDate}
                  placeholder={S.dueDate}
                />
              </div>
            )}
            <label className="block" htmlFor="document-customer-name">
              <span className="mb-1.5 block text-sm font-medium">{S.customerName}</span>
              <Input
                id="document-customer-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block" htmlFor="document-customer-email">
              <span className="mb-1.5 block text-sm font-medium">{S.customerEmail}</span>
              <Input
                id="document-customer-email"
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block sm:col-span-2" htmlFor="document-customer-address">
              <span className="mb-1.5 block text-sm font-medium">{S.customerAddress}</span>
              <Textarea
                id="document-customer-address"
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block sm:col-span-2" htmlFor="document-body">
              <span className="mb-1.5 block text-sm font-medium">{S.body}</span>
              <Textarea
                id="document-body"
                className="min-h-48 font-mono text-xs"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={pending}
              />
            </label>
          </div>
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
            <Button type="button" size="sm" disabled={pending} onClick={() => void saveDraft()}>
              {S.saveDraft}
            </Button>
            {saved && <span className="text-sm text-muted-foreground">{S.saved}</span>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="document-send"
              disabled={pending}
              onClick={() => setSendOpen(true)}
            >
              {S.send}
            </Button>
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

      <DocumentView
        document={{
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
        }}
      />

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
