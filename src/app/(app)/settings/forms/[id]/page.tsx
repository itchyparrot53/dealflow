import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/config/env";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { pipelines, stages, users } from "@/db/schema";
import type { FormField } from "@/features/forms/fields";
import { getForm, listEligibleCustomFields } from "@/features/forms/forms";
import { FormEditor } from "@/features/forms/ui/FormEditor";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../../SettingsHeading";
import { SettingsPage } from "../../SettingsSurface";

export const metadata = { title: FORMS_STRINGS.title };

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  if (!can(actor, "forms.manage")) {
    return <p className="text-sm text-destructive">{FORMS_STRINGS.adminOnly}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const form = await getForm(db, id, signal);
  if (form === null) notFound();

  const [pipelineRows, stageRows, userRows, customFields] = await Promise.all([
    db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines),
    db
      .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
      .from(stages)
      .orderBy(asc(stages.order)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)),
    listEligibleCustomFields(db, signal),
  ]);

  return (
    <SettingsPage className="max-w-3xl">
      <SettingsHeading title={form.name} description={FORMS_STRINGS.intro} />
      <FormEditor
        baseUrl={env.BASE_URL}
        form={{
          id: form.id,
          publicId: form.publicId,
          name: form.name,
          title: form.title,
          description: form.description,
          fields: form.fields as FormField[],
          creates: form.creates === "deal" ? "deal" : "lead",
          pipelineId: form.pipelineId,
          stageId: form.stageId,
          ownerId: form.ownerId,
          successMessage: form.successMessage,
          redirectUrl: form.redirectUrl,
          active: form.active,
        }}
        lookups={{
          pipelines: pipelineRows.map((pipeline) => ({
            ...pipeline,
            stages: stageRows
              .filter((stage) => stage.pipelineId === pipeline.id)
              .map((stage) => ({ id: stage.id, name: stage.name })),
          })),
          users: userRows,
          customFields: customFields.map((def) => ({
            id: def.id,
            name: def.name,
            targetEntity: def.targetEntity,
          })),
        }}
      />
    </SettingsPage>
  );
}
