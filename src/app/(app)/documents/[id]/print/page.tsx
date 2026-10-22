import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { db } from "@/db/client";
import { getDocument } from "@/features/documents/documents";
import { getDocumentSettings } from "@/features/documents/settings";
import { DocumentView } from "@/features/documents/ui/DocumentView";
import { PrintButton } from "@/features/documents/ui/PublicActions";
import { renderDocumentBody } from "@/features/documents/variables";
import { createContext } from "@/server/trpc/context";

export const metadata: Metadata = { title: "Print" };

// Internal print preview: the same DocumentView as the public page, with the app
// chrome hidden by the print stylesheet and a print button that does not print.
export default async function DocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const ctx = await createContext();
  if (ctx.actor === null) notFound();

  const signal = AbortSignal.timeout(5000);
  const result = await getDocument(db, ctx.actor, id, signal);
  if (!result.ok) notFound();
  const settings = await getDocumentSettings(db, signal);
  const doc = result.value;

  return (
    <div className="mx-auto max-w-[860px] p-6">
      <PageTitle title="Documents" />
      <div className="mb-4">
        <PrintButton label={DOCUMENTS_STRINGS.printPreview} />
      </div>
      <DocumentView
        document={{
          kind: doc.kind,
          number: doc.number,
          title: doc.title,
          body: renderDocumentBody(doc.body, doc),
          currency: doc.currency,
          subtotal: doc.subtotal,
          tax: doc.tax,
          total: doc.total,
          status: doc.status,
          customerName: doc.customerName,
          customerAddress: doc.customerAddress,
          issueDate: doc.issueDate,
          validUntil: doc.validUntil,
          dueDate: doc.dueDate,
          paidAt: doc.paidAt,
          outstanding: doc.outstanding,
          lines: doc.lines,
          company: {
            name: settings.companyName,
            address: settings.companyAddress,
            taxId: settings.companyTaxId,
          },
          paymentInstructions: settings.paymentInstructions,
          footer: settings.footer,
        }}
      />
    </div>
  );
}
