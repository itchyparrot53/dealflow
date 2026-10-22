import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { DOCUMENTS_STRINGS } from "@/constants/documentsStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { getDocumentSettings } from "@/features/documents/settings";
import { listTemplates } from "@/features/documents/templates";
import { DocumentsSettings } from "@/features/documents/ui/DocumentsSettings";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: DOCUMENTS_STRINGS.title };

// Settings > Documents. Admin only (the documents.manage capability is admin-granted
// and listed high-risk); the nav hides the link for everyone else, and this gate is
// the boundary, not the hiding.
export default async function DocumentsSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (actor.type !== "admin" || !can(actor, "documents.manage")) {
    return <p className="text-sm text-destructive">{DOCUMENTS_STRINGS.adminOnly}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const [settings, quotes, invoices] = await Promise.all([
    getDocumentSettings(db, signal),
    listTemplates(db, "quote", signal),
    listTemplates(db, "invoice", signal),
  ]);

  return (
    <SettingsPage className="max-w-3xl">
      <PageTitle title="Documents" />
      <SettingsHeading title={DOCUMENTS_STRINGS.title} description={DOCUMENTS_STRINGS.intro} />
      <DocumentsSettings settings={settings} templates={{ quote: quotes, invoice: invoices }} />
    </SettingsPage>
  );
}
