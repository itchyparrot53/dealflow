import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ERROR_IDS } from "@/constants/errorIds";
import { db } from "@/db/client";
import { clientIp, getPublicDocument } from "@/features/documents/publicDocuments";

// Public document page: no session, addressed by publicId only. It lives outside
// the `(app)` route group on purpose, the same way /t/click is public. Task 3.2
// replaces this minimal markup with the shared DocumentView.

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
          <p role="alert">Too many requests. Try again in a minute.</p>
        </main>
      );
    }
    notFound();
  }

  const doc = result.value;
  return (
    <main className="mx-auto max-w-[860px] bg-background p-8 text-foreground">
      <header className="border-b pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {doc.kind === "quote" ? "Quote" : "Invoice"}
        </p>
        <h1 className="text-display font-[450] leading-tight tracking-tight" data-testid="public-document">
          {doc.title}
        </h1>
        <p className="text-sm text-muted-foreground">{doc.number ?? "Draft"}</p>
        <p className="text-sm" data-testid="public-status">
          {doc.status}
        </p>
      </header>
      <section className="mt-6 whitespace-pre-wrap text-sm">{doc.body}</section>
      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={line.id} className="border-b">
                <td className="py-2">{line.name}</td>
                <td className="py-2">{line.quantity}</td>
                <td className="py-2 text-right">{line.itemPrice}</td>
                <td className="py-2 text-right">{line.gross}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto max-w-xs text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>
              {doc.subtotal} {doc.currency}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>
              {doc.tax} {doc.currency}
            </dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>
              {doc.total} {doc.currency}
            </dd>
          </div>
        </dl>
      </section>
      {doc.company.name !== null && <p className="mt-8 text-sm">{doc.company.name}</p>}
      {doc.paymentInstructions !== null && (
        <p className="mt-4 whitespace-pre-wrap text-sm">{doc.paymentInstructions}</p>
      )}
      {doc.footer !== null && <p className="mt-4 text-xs text-muted-foreground">{doc.footer}</p>}
    </main>
  );
}
