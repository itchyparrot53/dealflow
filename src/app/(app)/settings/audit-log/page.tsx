import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listAuditEvents } from "@/features/audit/auditLog";
import { AuditLog } from "@/features/audit/ui/AuditLog";
import { listAssignableUsers } from "@/features/identity/users.service";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

const S = PROJECTS_API_STRINGS.audit;

export const metadata: Metadata = { title: S.title };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    actorId?: string;
    action?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
}): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  const params = await searchParams;
  const signal = AbortSignal.timeout(10_000);
  const [result, users] = await Promise.all([
    listAuditEvents(
      db,
      actor,
      {
        ...(params.actorId === undefined ? {} : { actorId: params.actorId }),
        ...(params.action === undefined ? {} : { action: params.action }),
        ...(params.from === undefined ? {} : { from: params.from }),
        ...(params.to === undefined ? {} : { to: params.to }),
      },
      params.cursor ?? null,
      signal,
    ),
    listAssignableUsers(db, signal),
  ]);
  if (!result.ok) {
    return <p className="text-sm text-destructive">{S.adminOnly}</p>;
  }
  return (
    <SettingsPage className="max-w-6xl">
      <PageTitle title="Audit log" />
      <SettingsHeading title={S.title} description={S.intro} />
      <AuditLog
        rows={result.value.rows}
        actions={result.value.actions}
        users={users}
        filters={params}
        nextCursor={result.value.nextCursor}
        hasCursor={params.cursor !== undefined}
      />
    </SettingsPage>
  );
}
