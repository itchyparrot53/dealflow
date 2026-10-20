"use client";

import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { PILL_TAB, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { formatMoney, parseCents } from "@/features/currency/money";
import type { DocumentListItem } from "@/features/documents/documents";
import type { DocKind, DocStatus } from "@/features/documents/transitions";
import { longDate } from "./DocumentView";

const S = DOCUMENTS_STRINGS;

const STATUS_LABEL: Record<DocStatus, string> = {
  draft: S.statusDraft,
  sent: S.statusSent,
  viewed: S.statusViewed,
  accepted: S.statusAccepted,
  declined: S.statusDeclined,
  overdue: S.statusOverdue,
  paid: S.statusPaid,
  void: S.statusVoid,
};

function statusVariant(status: DocStatus): BadgeProps["variant"] {
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

const STATUS_OPTIONS = [
  { value: "all", label: S.allStatuses },
  ...(Object.keys(STATUS_LABEL) as DocStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABEL[status],
  })),
];

interface Props {
  rows: DocumentListItem[];
  base: string;
  outstandingTotal: string;
  excludedCurrencies: string[];
}

export function DocumentsList({
  rows,
  base,
  outstandingTotal,
  excludedCurrencies,
}: Props): React.ReactNode {
  const [kind, setKind] = useState<DocKind>("quote");
  const [status, setStatus] = useState<string>("all");

  const visible = rows.filter(
    (row) => row.kind === kind && (status === "all" || row.status === status),
  );
  const isInvoice = kind === "invoice";

  return (
    <section className="space-y-4" data-testid="documents-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={kind} onValueChange={(value) => setKind(value as DocKind)}>
          <TabsList className="gap-1 rounded-md border p-1">
            <TabsTrigger value="quote" className={PILL_TAB}>
              {S.tabQuotes}
            </TabsTrigger>
            <TabsTrigger value="invoice" className={PILL_TAB}>
              {S.tabInvoices}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-48">
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            ariaLabel={S.statusFilter}
          />
        </div>
      </div>

      {isInvoice && (
        <div className="flex flex-wrap items-baseline gap-3 rounded-md border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">{S.outstanding}</span>
          <span className="text-lg font-semibold" data-testid="documents-outstanding-total">
            {formatMoney(parseCents(outstandingTotal), base)}
          </span>
          {excludedCurrencies.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {S.excludedCurrencies}: {excludedCurrencies.join(", ")}
            </span>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.noMatches}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 font-medium">{S.columnNumber}</th>
              <th className="py-2 font-medium">{S.columnTitle}</th>
              <th className="py-2 font-medium">{S.columnDeal}</th>
              <th className="py-2 font-medium">{S.columnCustomer}</th>
              <th className="py-2 text-right font-medium">{S.columnTotal}</th>
              <th className="py-2 font-medium">{S.columnStatus}</th>
              <th className="py-2 font-medium">{S.columnIssued}</th>
              <th className="py-2 font-medium">{isInvoice ? S.columnDue : S.columnValid}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="py-2 font-mono text-xs">
                  <Link href={`/documents/${row.id}`} className="hover:underline">
                    {row.number ?? S.statusDraft}
                  </Link>
                </td>
                <td className="py-2">
                  <Link href={`/documents/${row.id}`} className="font-medium hover:underline">
                    {row.title}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">{row.dealTitle}</td>
                <td className="py-2 text-muted-foreground">{row.customerName ?? ""}</td>
                <td className="py-2 text-right">
                  {formatMoney(parseCents(row.total), row.currency)}
                </td>
                <td className="py-2">
                  <Badge variant={statusVariant(row.status)}>{STATUS_LABEL[row.status]}</Badge>
                </td>
                <td className="py-2 text-muted-foreground">{longDate(row.issueDate)}</td>
                <td className="py-2 text-muted-foreground">
                  {longDate(isInvoice ? row.dueDate : row.validUntil)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
