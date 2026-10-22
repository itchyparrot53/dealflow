import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listDeleted, type RecycleEntity, recycleEntitySchema } from "@/features/recycle/recycle";
import { RecycleBin } from "@/features/recycle/ui/RecycleBin";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

const S = PROJECTS_API_STRINGS.recycle;

export const metadata: Metadata = { title: S.title };

// Settings > Recycle bin. Every signed-in user restores what they own or deleted; the service
// hides everyone else's items.
export default async function RecycleBinPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; search?: string }>;
}): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-muted-foreground">{SETTINGS_STRINGS.requiresAuth}</p>;
  }
  const params = await searchParams;
  const parsedEntity = recycleEntitySchema.safeParse(params.entity);
  const entity: RecycleEntity | undefined = parsedEntity.success ? parsedEntity.data : undefined;
  const rows = await listDeleted(
    db,
    actor,
    {
      ...(entity === undefined ? {} : { entity }),
      ...(params.search === undefined ? {} : { search: params.search }),
    },
    AbortSignal.timeout(10_000),
  );

  return (
    <SettingsPage className="max-w-5xl">
      <PageTitle title="Recycle bin" />
      <SettingsHeading title={S.title} description={S.intro} />
      <RecycleBin rows={rows} filters={{ entity: params.entity, search: params.search }} />
    </SettingsPage>
  );
}
