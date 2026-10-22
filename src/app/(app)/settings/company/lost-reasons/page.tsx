import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { PERMISSION_FLAGS } from "@/constants/permissionFlags";
import { STRINGS } from "@/constants/strings";
import { db } from "@/db/client";
import { listLostReasons } from "@/features/settings/lostReasonsRepo";
import { createContext } from "@/server/trpc/context";
import { LostReasonsClient } from "./LostReasonsClient";

export const metadata = { title: STRINGS.settings.lostReasons };

// Company settings > Lost reasons tab (spec 6.3): catalog list + add + rename + reorder + archive.
export default async function LostReasonsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null || (actor.type !== "admin" && !actor.flags.has(PERMISSION_FLAGS.MANAGE))) {
    return <p className="text-sm text-destructive">{STRINGS.settings.requiresAdmin}</p>;
  }

  const rows = await listLostReasons(db, AbortSignal.timeout(5000));
  const serializable = rows.map((r) => ({ id: r.id, name: r.name }));
  return (
    <>
      <PageTitle title="Lost reasons" />
      <LostReasonsClient rows={serializable} />
    </>
  );
}
