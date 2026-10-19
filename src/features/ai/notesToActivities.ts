import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { notes } from "@/db/schema";
import { getWorkspace } from "@/features/deal-workspace/summaryRepo";
import type { HydratedActor } from "@/server/hydrateActor";
import { err, ok, type Result } from "@/types/result";
import { listActiveActivityTypeKeys, resolveActivityKey } from "./activityTypeKeys";
import { chatJson } from "./chatJson";

const MAX_PROPOSALS = 5;

export interface ActivityProposal {
  subject: string;
  typeKey: string;
  dueDate: string;
  note: string;
}

export interface NoteProposals {
  dealId: string;
  proposals: ActivityProposal[];
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekdayUtc(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

export function notesPrompt(keys: readonly string[]): string {
  return `You turn meeting or call notes into follow-up activities for a CRM. Today is ${todayUtc()} (${weekdayUtc()}). Reply with JSON only: {"activities": [{"subject": string (max 12 words), "typeKey": one of ${keys.join(", ")}, "dueDate": "YYYY-MM-DD" (today or later), "note": string (max 40 words)}]} with at most 5 items. Only include concrete follow-ups the notes imply. If there are none, reply {"activities": []}.`;
}

function proposalsSchema(keys: readonly string[], today: string) {
  return z
    .object({
      activities: z.array(
        z.object({
          subject: z.string(),
          typeKey: z.string(),
          dueDate: z.string(),
          note: z.string(),
        }),
      ),
    })
    .transform((value): ActivityProposal[] =>
      value.activities.slice(0, MAX_PROPOSALS).map((item) => ({
        subject: item.subject,
        typeKey: resolveActivityKey(keys, item.typeKey),
        // A date in the past is never a follow-up: clamp it to today.
        dueDate:
          /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.dueDate >= today ? item.dueDate : today,
        note: item.note,
      })),
    );
}

export async function proposeActivitiesFromNote(
  db: Db,
  actor: HydratedActor,
  noteId: string,
  signal: AbortSignal,
): Promise<Result<NoteProposals, AppError>> {
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), isNull(notes.deletedAt)))
    .limit(1);
  signal.throwIfAborted();

  if (note === undefined || note.entityType !== "deal") {
    return err(new AppError(ERROR_IDS.AI_INPUT_INVALID, "only deal notes can become activities"));
  }
  // The note inherits its parent's visibility, so the deal gate is the note gate.
  const workspace = await getWorkspace(db, actor, note.entityId, signal);
  if (!workspace.ok) return workspace;

  const keys = await listActiveActivityTypeKeys(db, signal);
  const today = todayUtc();
  const result = await chatJson(
    db,
    actor.id,
    "notes_to_activities",
    {
      system: notesPrompt(keys),
      user: note.body,
      schema: proposalsSchema(keys, today),
      maxTokens: 700,
    },
    signal,
  );
  if (!result.ok) return result;
  return ok({ dealId: note.entityId, proposals: result.value });
}
