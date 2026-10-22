import type React from "react";
import { formatMoney, parseCents } from "@/features/currency/money";
import type { DocumentLineView } from "../lines";
import type { DocKind, DocStatus } from "../transitions";
import { MarkdownLite } from "./MarkdownLite";

// The one document presentation: the internal page, the print preview and the
// public page all render this, so a quote or invoice looks identical everywhere.

export interface DocumentViewCompany {
  name: string | null;
  address: string | null;
  taxId: string | null;
}

export interface DocumentViewData {
  kind: DocKind;
  number: string | null;
  title: string;
  // Already rendered: document.* variables are resolved by the caller.
  body: string;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  status: DocStatus;
  customerName: string | null;
  customerAddress: string | null;
  issueDate: string | null;
  validUntil: string | null;
  dueDate: string | null;
  paidAt: string | null;
  outstanding?: string | null;
  lines: readonly DocumentLineView[];
  company: DocumentViewCompany;
  paymentInstructions: string | null;
  footer: string | null;
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export function longDate(value: string | null): string {
  if (value === null) return "";
  return LONG_DATE.format(new Date(`${value}T00:00:00Z`));
}

function money(value: string, currency: string): string {
  return formatMoney(parseCents(value), currency);
}

// Quote and invoice dates read differently; one function keeps them consistent.
function dateLines(doc: DocumentViewData): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [];
  if (doc.kind === "quote") {
    if (doc.issueDate !== null) lines.push({ label: "Issued", value: longDate(doc.issueDate) });
    if (doc.validUntil !== null) {
      lines.push({ label: "Valid until", value: longDate(doc.validUntil) });
    }
    return lines;
  }
  if (doc.issueDate !== null) lines.push({ label: "Issued", value: longDate(doc.issueDate) });
  if (doc.dueDate !== null) lines.push({ label: "Due", value: longDate(doc.dueDate) });
  return lines;
}

function invoiceStatusLine(doc: DocumentViewData): string | null {
  if (doc.kind !== "invoice") return null;
  if (doc.status === "paid" && doc.paidAt !== null)
    return `Paid on ${longDate(doc.paidAt.slice(0, 10))}`;
  if (doc.status === "overdue" && doc.dueDate !== null) {
    return `Overdue since ${longDate(doc.dueDate)}`;
  }
  if (doc.dueDate !== null) return `Due ${longDate(doc.dueDate)}`;
  return null;
}

export function DocumentView({ document }: { document: DocumentViewData }): React.ReactNode {
  const dates = dateLines(document);
  const statusLine = invoiceStatusLine(document);
  const customerLabel = document.kind === "quote" ? "Prepared for" : "Billed to";
  const total = money(document.total, document.currency);

  return (
    <article className="mx-auto w-full max-w-[860px] rounded-lg border border-border bg-background p-6 text-foreground sm:p-10">
      <header className="flex items-start justify-between gap-6 border-b pb-6">
        <div className="min-w-0">
          {document.company.name !== null && (
            <p className="text-base font-semibold">{document.company.name}</p>
          )}
          {document.company.address !== null && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {document.company.address}
            </p>
          )}
          {document.company.taxId !== null && (
            <p className="text-sm text-muted-foreground">Tax ID: {document.company.taxId}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-meta font-semibold text-muted-foreground">
            {document.kind === "quote" ? "Quote" : "Invoice"}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="document-number">
            {document.number ?? "Draft"}
          </p>
        </div>
      </header>

      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{document.title}</h2>
          {statusLine !== null && (
            <p className="mt-1 text-sm text-muted-foreground">{statusLine}</p>
          )}
        </div>
        {dates.length > 0 && (
          <dl className="shrink-0 space-y-1 text-right text-sm">
            {dates.map((line) => (
              <div key={line.label}>
                <dt className="inline text-muted-foreground">{line.label}: </dt>
                <dd className="inline">{line.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {(document.customerName !== null || document.customerAddress !== null) && (
        <section className="mt-6">
          <p className="text-meta font-semibold text-muted-foreground">{customerLabel}</p>
          {document.customerName !== null && <p className="font-medium">{document.customerName}</p>}
          {document.customerAddress !== null && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {document.customerAddress}
            </p>
          )}
        </section>
      )}

      <section className="mt-8">
        <MarkdownLite source={document.body} lines={document.lines} currency={document.currency} />
      </section>

      <section className="mt-8 flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{money(document.subtotal, document.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd>{money(document.tax, document.currency)}</dd>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd data-testid="document-total">{total}</dd>
          </div>
        </dl>
      </section>

      {document.kind === "invoice" && document.paymentInstructions !== null && (
        <section className="mt-8 border-t pt-4">
          <p className="text-meta font-semibold text-muted-foreground">Payment</p>
          <p className="whitespace-pre-wrap text-sm">{document.paymentInstructions}</p>
        </section>
      )}

      {document.footer !== null && (
        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
          <p className="whitespace-pre-wrap">{document.footer}</p>
        </footer>
      )}
    </article>
  );
}
