import { redirect } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { ForecastBoard } from "@/features/forecast/ui/ForecastBoard";
import { createContext } from "@/server/trpc/context";
import { createCaller } from "@/server/trpc/root";

export const metadata = { title: "Forecast" };

// /forecast: open deals by expected close month, won deals by won month, and the
// no-date list. The board reads through the tRPC query so filter changes do not
// reload the RSC tree.
export default async function ForecastPage(): Promise<React.ReactNode> {
  const ctx = await createContext();
  if (ctx.actor === null) redirect("/login");
  const pipelines = await createCaller(ctx).pipeline.list();

  return (
    <main aria-label="Forecast" className="flex h-full flex-col p-4">
      <PageTitle title="Forecast" />
      <ForecastBoard
        pipelines={pipelines.map((pipeline) => ({ id: pipeline.id, name: pipeline.name }))}
      />
    </main>
  );
}
