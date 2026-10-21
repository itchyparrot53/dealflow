import { asc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { activityTypes, emailTemplates, pipelines, stages, users } from "@/db/schema";
import { getAutomation } from "@/features/automations/service";
import { AutomationEditor } from "@/features/automations/ui/AutomationEditor";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../../SettingsHeading";
import { SettingsPage } from "../../SettingsSurface";

export const metadata = { title: AUTOMATIONS_STRINGS.title };

export default async function AutomationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (!can(actor, "automations.manage")) {
    return <p className="text-sm text-destructive">{AUTOMATIONS_STRINGS.adminOnly}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const automation = await getAutomation(db, id, signal);
  if (automation === null) notFound();

  const [pipelineRows, stageRows, userRows, typeRows, templateRows] = await Promise.all([
    db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines),
    db
      .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
      .from(stages)
      .orderBy(asc(stages.order)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)),
    db
      .select({ id: activityTypes.id, name: activityTypes.name })
      .from(activityTypes)
      .where(isNull(activityTypes.archivedAt)),
    db
      .select({ id: emailTemplates.id, name: emailTemplates.name })
      .from(emailTemplates)
      .where(or(eq(emailTemplates.ownerId, actor.id), eq(emailTemplates.isShared, true))),
  ]);

  return (
    <SettingsPage className="max-w-3xl">
      <SettingsHeading title={automation.name} description={AUTOMATIONS_STRINGS.intro} />
      <AutomationEditor
        automation={automation}
        lookups={{
          pipelines: pipelineRows.map((pipeline) => ({
            ...pipeline,
            stages: stageRows
              .filter((stage) => stage.pipelineId === pipeline.id)
              .map((stage) => ({ id: stage.id, name: stage.name })),
          })),
          users: userRows,
          activityTypes: typeRows,
          emailTemplates: templateRows,
        }}
      />
    </SettingsPage>
  );
}
