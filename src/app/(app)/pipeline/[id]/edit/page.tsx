import { inArray } from "drizzle-orm";
import { STRINGS } from "@/constants/strings";
import { db } from "@/db/client";
import { stageProbabilities } from "@/db/schema";
import { EditPipelineClient } from "@/features/pipelines/EditPipelineClient";
import { createContext } from "@/server/trpc/context";
import { createCaller } from "@/server/trpc/root";

export const metadata = { title: STRINGS.titles.editPipeline };

export default async function EditPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  const ctx = await createContext();
  if (ctx.actor === null) {
    return <main>Unauthorized</main>;
  }
  const caller = createCaller(ctx);
  const pipeline = await caller.pipeline.byId(id);
  if (pipeline === null) {
    return <main>Pipeline not found</main>;
  }
  const counts = await caller.pipeline.stageDealCounts(id);
  const stageIds = pipeline.stages.map((s) => s.id);
  const probabilities =
    stageIds.length === 0
      ? []
      : await db
          .select()
          .from(stageProbabilities)
          .where(inArray(stageProbabilities.stageId, stageIds));
  const probabilityByStage = new Map(probabilities.map((row) => [row.stageId, row.probability]));

  return (
    <main aria-label={`Edit pipeline ${pipeline.name}`} className="h-full">
      <h1 className="mb-4 text-display font-[450] leading-tight tracking-tight">Edit pipeline</h1>
      <EditPipelineClient
        pipelineId={pipeline.id}
        pipelineName={pipeline.name}
        stages={pipeline.stages.map((s) => ({
          id: s.id,
          name: s.name,
          rottingDays: s.rottingDays,
          dealCount: counts[s.id]?.total ?? 0,
          closedDealCount: counts[s.id]?.closed ?? 0,
          probability: probabilityByStage.get(s.id) ?? 100,
        }))}
      />
    </main>
  );
}
