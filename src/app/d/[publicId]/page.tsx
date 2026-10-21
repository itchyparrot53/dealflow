import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { getPublicDocument } from "@/features/documents/publicDocuments";
import { DocumentView } from "@/features/documents/ui/DocumentView";
import { PrintButton, PublicActions } from "@/features/documents/ui/PublicActions";
import { clientIp } from "@/features/net/clientIp";

// Public document page: no session, addressed by publicId only. It lives outside
// the `(app)` route group on purpose, the same way /t/click is public.

export const metadata: Metadata = { title: "Document" };

export default async function PublicDocumentPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<ReactNode> {
  const { publicId } = await params;
  const requestHeaders = await headers();
  const result = await getPublicDocument(
    db,
    publicId,
    { ip: clientIp(requestHeaders) },
    AbortSignal.timeout(5000),
  );
  if (!result.ok) {
    if (result.error.id === ERROR_IDS.DOC_RATE_LIMITED) {
      return (
        <main className="mx-auto max-w-[860px] p-8">
          <p role="alert">{DOCUMENTS_STRINGS.errors.rateLimited}</p>
        </main>
      );
    }
    notFound();
  }

  const doc = result.value;
  return (
    <main className="mx-auto max-w-[860px] p-8" data-testid="public-document">
      {/* The machine-readable status is for tests and the outline; the visible status is the
          invoice line in DocumentView and the accept/decline panel below. */}
      <p className="sr-only" data-testid="public-status">
        {doc.status}
      </p>
      <DocumentView
        document={{
          kind: doc.kind,
          number: doc.number,
          title: doc.title,
          body: doc.body,
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
          company: doc.company,
          paymentInstructions: doc.paymentInstructions,
          footer: doc.footer,
        }}
      />
      {doc.kind === "quote" && (
        <div className="mt-6">
          <PublicActions
            publicId={doc.publicId}
            status={doc.status}
            expired={doc.expired}
            ownerName={doc.ownerName}
            acceptedName={doc.acceptedName}
            acceptedAt={doc.acceptedAt}
            declinedAt={doc.declinedAt}
            declineReason={doc.declineReason}
          />
        </div>
      )}
      <div className="mt-6">
        <PrintButton label={DOCUMENTS_STRINGS.downloadPdf} />
      </div>
    </main>
  );
}
