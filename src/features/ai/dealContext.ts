import { eq } from "drizzle-orm";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { stages } from "@/db/schema";
import { listActivitiesForEntity } from "@/features/activities/forEntity";
import { listNotes } from "@/features/collaboration/notesRepo";
import { getWorkspace } from "@/features/deal-workspace/summaryRepo";
import { readBaseCurrency } from "@/features/settings/readBaseCurrency";
import type { HydratedActor } from "@/server/hydrateActor";
import { ok, type Result } from "@/types/result";

const MS_PER_DAY = 86_400_000;
const MAX_UPCOMING = 10;
const MAX_RECENT = 10;
const MAX_NOTES = 10;
const NOTE_BODY_LIMIT = 400;

export interface DealContext {
  today: string;
  deal: {
    title: string;
    value: number | null;
    currency: string;
    pipeline: string;
    stage: string | null;
    status: string;
    expectedCloseDate: string | null;
    daysInStage: number;
    person: string | null;
    organization: string | null;
    owner: string | null;
    labels: string[];
  };
  upcomingActivities: { subject: string; type: string; dueAt: string }[];
  recentActivities: { subject: string; type: string; doneAt: string }[];
  notes: { at: string; text: string }[];
}

// Everything the AI prompts may know about one deal, already filtered by what the actor can see:
// getWorkspace is the visibility gate, and notes/activities are only read after it passes.
export async function buildDealContext(
  db: Db,
  actor: HydratedActor,
  dealId: string,
  signal: AbortSignal,
): Promise<Result<DealContext, AppError>> {
  const workspace = await getWorkspace(db, actor, dealId, signal);
  if (!workspace.ok) return workspace;

  const [stageRow] = await db
    .select({ name: stages.name })
    .from(stages)
    .where(eq(stages.id, workspace.value.deal.stageId))
    .limit(1);
  const [notes, activities, currency] = await Promise.all([
    listNotes(db, "deal", dealId, signal),
    listActivitiesForEntity(db, actor, "deal", dealId, signal),
    readBaseCurrency(db, signal),
  ]);
  signal.throwIfAborted();

  const now = new Date();
  const deal = workspace.value.deal;
  const open = activities
    .filter((activity) => !activity.done && activity.dueAt.getTime() >= now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, MAX_UPCOMING);
  const done = activities
    .filter((activity) => activity.done)
    .sort((a, b) => (b.doneAt ?? b.dueAt).getTime() - (a.doneAt ?? a.dueAt).getTime())
    .slice(0, MAX_RECENT);

  return ok({
    today: now.toISOString().slice(0, 10),
    deal: {
      title: deal.title,
      value: deal.value === null ? null : Number(deal.value),
      currency,
      pipeline: workspace.value.pipelineName,
      stage: stageRow?.name ?? null,
      status: deal.status,
      expectedCloseDate: deal.expectedCloseDate,
      daysInStage: Math.max(
        0,
        Math.floor((now.getTime() - deal.stageEnteredAt.getTime()) / MS_PER_DAY),
      ),
      person: workspace.value.person?.name ?? null,
      organization: workspace.value.org?.name ?? null,
      owner: workspace.value.owner?.name ?? null,
      labels: deal.labels,
    },
    upcomingActivities: open.map((activity) => ({
      subject: activity.subject,
      type: activity.typeKey,
      dueAt: activity.dueAt.toISOString(),
    })),
    recentActivities: done.map((activity) => ({
      subject: activity.subject,
      type: activity.typeKey,
      doneAt: (activity.doneAt ?? activity.dueAt).toISOString(),
    })),
    notes: notes.slice(0, MAX_NOTES).map((note) => ({
      at: note.createdAt.toISOString(),
      text: note.body.slice(0, NOTE_BODY_LIMIT),
    })),
  });
}
