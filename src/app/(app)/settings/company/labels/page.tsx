import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { PERMISSION_FLAGS } from "@/constants/permissionFlags";
import { STRINGS } from "@/constants/strings";
import { db } from "@/db/client";
import { listLabels } from "@/features/labels/labelsRepo";
import { createContext } from "@/server/trpc/context";
import { LabelsClient } from "./LabelsClient";

export const metadata = { title: STRINGS.settings.labels };

// Company settings > Labels tab (spec 6.4): labels grouped by target with an enum color picker.
export default async function LabelsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null || (actor.type !== "admin" && !actor.flags.has(PERMISSION_FLAGS.MANAGE))) {
    return <p className="text-sm text-destructive">{STRINGS.settings.requiresAdmin}</p>;
  }

  const rows = await listLabels(db, {}, AbortSignal.timeout(5000));
  const serializable = rows.map((l) => ({
    id: l.id,
    target: l.target,
    name: l.name,
    color: l.color,
  }));
  return (
    <>
      <PageTitle title="Labels" />
      <LabelsClient rows={serializable} />
    </>
  );
}
