import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { env } from "@/config/env";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { backupRuns } from "@/db/schema";
import { BackupsSettings } from "@/features/backups/ui/BackupsSettings";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

const S = PROJECTS_API_STRINGS.backups;

export const metadata: Metadata = { title: S.title };

// Settings > Backups. Admin-only: the status, "Back up now", the runs table and the restore
// commands. Restoring itself is CLI-only (the page never triggers one).
export default async function BackupsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (actor.type !== "admin") {
    return <p className="text-sm text-destructive">{S.adminOnly}</p>;
  }
  const rows = await db.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(50);
  return (
    <SettingsPage className="max-w-5xl">
      <PageTitle title="Backups" />
      <SettingsHeading title={S.title} description={S.intro} />
      <BackupsSettings
        enabled={env.BACKUP_ENABLED}
        directory={env.BACKUP_DIR}
        keep={env.BACKUP_KEEP}
        nextRun="02:00 UTC daily"
        rows={rows.map((row) => ({
          id: row.id,
          fileName: row.fileName,
          status: row.status as "running" | "succeeded" | "failed",
          trigger: row.trigger as "schedule" | "manual",
          sizeBytes: row.sizeBytes,
          fileCount: row.fileCount,
          errorDetail: row.errorDetail,
          startedAt: row.startedAt.toISOString(),
        }))}
      />
    </SettingsPage>
  );
}
