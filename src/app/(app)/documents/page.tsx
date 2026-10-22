import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { loadDocumentsList } from "@/features/documents/documents";
import { DocumentsList } from "@/features/documents/ui/DocumentsList";
import { ExportButton } from "@/features/export/ui/ExportButton";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";

export const metadata: Metadata = { title: DOCUMENTS_STRINGS.title };

// /documents. The read reuses the deals visibility clause, so a hidden deal's
// documents never appear, and the invoice outstanding total is converted to the
// base currency with the shared summarize().
export default async function DocumentsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  const result = await loadDocumentsList(db, actor, AbortSignal.timeout(5000));
  if (!result.ok) {
    return <p className="text-sm text-destructive">{DOCUMENTS_STRINGS.saveFailed}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-title">{DOCUMENTS_STRINGS.title}</h1>
        {can(actor, "data.export") && (
          <ExportButton
            entity="invoices"
            columns={["number", "title", "status", "total", "currency", "dueDate", "customerName"]}
          />
        )}
      </div>
      <DocumentsList
        rows={result.value.rows}
        base={result.value.base}
        outstandingTotal={result.value.outstandingTotal}
        excludedCurrencies={result.value.excludedCurrencies}
      />
    </div>
  );
}
