import { asc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import {
  activityTypes,
  emailTemplates,
  pipelines,
  sequences,
  stages,
  users,
  webForms,
} from "@/db/schema";
import { getAutomation } from "@/features/automations/service";
import { AutomationEditor } from "@/features/automations/ui/AutomationEditor";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../../SettingsHeading";
import { SettingsPage } from "../../SettingsSurface";

export const metadata = { title: AUTOMATIONS_STRINGS.title };

export default async function AutomationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ drafted?: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const { drafted } = await searchParams;
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

  const [pipelineRows, stageRows, userRows, typeRows, templateRows, formRows, sequenceRows] =
    await Promise.all([
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
      db.select({ id: webForms.id, name: webForms.name }).from(webForms),
      // Only an active sequence can be enrolled in; the picker shows exactly those.
      db
        .select({ id: sequences.id, name: sequences.name })
        .from(sequences)
        .where(eq(sequences.status, "active"))
        .orderBy(asc(sequences.name)),
    ]);

  return (
    <SettingsPage className="max-w-3xl">
      <PageTitle title="Automations" />
      <SettingsHeading title={automation.name} description={AUTOMATIONS_STRINGS.intro} />
      <AutomationEditor
        reviewNote={drafted === "1"}
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
          forms: formRows,
          sequences: sequenceRows,
        }}
      />
    </SettingsPage>
  );
}
