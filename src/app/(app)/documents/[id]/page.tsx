import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/db/client";
import { getDocument } from "@/features/documents/documents";
import { getDocumentSettings } from "@/features/documents/settings";
import { DocumentEditor } from "@/features/documents/ui/DocumentEditor";
import { createContext } from "@/server/trpc/context";

export const metadata: Metadata = { title: "Document" };

// Internal document page. Reading follows deal visibility; every mutation on the
// page is gated by the deal's edit rights inside the services.
export default async function DocumentPage({
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

  return (
    <DocumentEditor
      document={result.value}
      company={{
        name: settings.companyName,
        address: settings.companyAddress,
        taxId: settings.companyTaxId,
      }}
      paymentInstructions={settings.paymentInstructions}
      footer={settings.footer}
    />
  );
}
