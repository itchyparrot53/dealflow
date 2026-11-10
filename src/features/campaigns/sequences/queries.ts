import { desc, eq, inArray, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import type { Db } from "@/db/client";
import {
  campaignSettings,
  campaigns,
  sequenceEnrollments,
  sequenceSteps,
  sequences,
} from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { listSavedFilters } from "@/features/saved-filters/savedFilterActions";
import { campaignDocumentSchema } from "../blocks/schema";
import { listSenders, type SenderView } from "../senders";
import { asCampaignTotals } from "../tracking/totals";
import {
  DEFAULT_SEND_WINDOW,
  DEFAULT_SEQUENCE_ENTRY,
  DEFAULT_SEQUENCE_EXIT,
  defaultSequenceEmailContent,
  type SendWindow,
  type SequenceEntry,
  type SequenceExit,
  sendWindowSchema,
  sequenceEntrySchema,
  sequenceExitSchema,
} from "./model";

// Read models for the /campaigns/automated list and editor. The editor needs the step stats from
// the hidden nurture campaigns, the sender and person-filter lookups, and the enrollment counts.

export interface SequenceEnrollmentCounts {
  active: number;
  completed: number;
  exited: number;
  failed: number;
}

export interface SequenceListRow {
  id: string;
  name: string;
  status: string;
  stepCount: number;
  enrollments: SequenceEnrollmentCounts;
  updatedAt: string;
}

export interface SequenceStepStats {
  sent: number;
  delivered: number;
  openRate: number | null;
  clickRate: number | null;
}

export interface SequenceStepView {
  id: string;
  position: number;
  kind: "email" | "wait";
  subject: string | null;
  preheader: string | null;
  content: unknown;
  waitMinutes: number | null;
  stats: SequenceStepStats | null;
}

export interface SequenceEditorView {
  id: string;
  name: string;
  status: string;
  senderId: string | null;
  replyTo: string | null;
  entry: SequenceEntry;
  exit: SequenceExit;
  sendWindow: SendWindow;
  steps: SequenceStepView[];
  senders: SenderView[];
  savedFilters: { id: string; name: string }[];
  enrollments: SequenceEnrollmentCounts;
  hasPostalAddress: boolean;
}

function countsFromRows(rows: { status: string; count: number }[]): SequenceEnrollmentCounts {
  const counts: SequenceEnrollmentCounts = { active: 0, completed: 0, exited: 0, failed: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status as keyof SequenceEnrollmentCounts] = row.count;
  }
  return counts;
}

async function enrollmentCounts(
  db: Db,
  sequenceIds: string[],
  signal: AbortSignal,
): Promise<Map<string, SequenceEnrollmentCounts>> {
  if (sequenceIds.length === 0) return new Map();
  const rows = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      status: sequenceEnrollments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(sequenceEnrollments)
    .where(inArray(sequenceEnrollments.sequenceId, sequenceIds))
    .groupBy(sequenceEnrollments.sequenceId, sequenceEnrollments.status);
  signal.throwIfAborted();
  const grouped = new Map<string, { status: string; count: number }[]>();
  for (const row of rows) {
    const list = grouped.get(row.sequenceId) ?? [];
    list.push({ status: row.status, count: row.count });
    grouped.set(row.sequenceId, list);
  }
  return new Map(
    [...grouped.entries()].map(([sequenceId, list]) => [sequenceId, countsFromRows(list)]),
  );
}

export async function listSequences(db: Db, signal: AbortSignal): Promise<SequenceListRow[]> {
  const rows = await db.select().from(sequences).orderBy(desc(sequences.updatedAt));
  signal.throwIfAborted();
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const stepRows = await db
    .select({
      sequenceId: sequenceSteps.sequenceId,
      count: sql<number>`count(*)::int`,
    })
    .from(sequenceSteps)
    .where(inArray(sequenceSteps.sequenceId, ids))
    .groupBy(sequenceSteps.sequenceId);
  signal.throwIfAborted();
  const stepCounts = new Map(stepRows.map((row) => [row.sequenceId, row.count]));
  const enrollments = await enrollmentCounts(db, ids, signal);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    stepCount: stepCounts.get(row.id) ?? 0,
    enrollments: enrollments.get(row.id) ?? { ...countsFromRows([]) },
    updatedAt: row.updatedAt.toISOString(),
  }));
}

function parsedOrDefault<T>(schema: ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function stepStats(totals: unknown): SequenceStepStats {
  const value = asCampaignTotals(totals);
  return {
    sent: value.sent,
    delivered: value.delivered,
    openRate: value.delivered > 0 ? value.uniqueHumanOpens / value.delivered : null,
    clickRate: value.delivered > 0 ? value.uniqueClicks / value.delivered : null,
  };
}

export async function getSequenceEditorView(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<SequenceEditorView | null> {
  if (!can(actor, "campaigns.view")) return null;
  const [sequence] = await db.select().from(sequences).where(eq(sequences.id, id)).limit(1);
  signal.throwIfAborted();
  if (sequence === undefined) return null;

  const stepRows = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, id))
    .orderBy(sequenceSteps.position);
  signal.throwIfAborted();
  const campaignIds = stepRows
    .map((step) => step.campaignId)
    .filter((value): value is string => value !== null);
  const campaignRows =
    campaignIds.length === 0
      ? []
      : await db
          .select({ id: campaigns.id, totals: campaigns.totals })
          .from(campaigns)
          .where(inArray(campaigns.id, campaignIds));
  signal.throwIfAborted();
  const totalsById = new Map(campaignRows.map((row) => [row.id, row.totals]));

  const [senders, filters, counts, [settings]] = await Promise.all([
    listSenders(db, signal),
    listSavedFilters(
      db,
      {
        userId: actor.id,
        isAdmin: actor.type === "admin",
        flags: Object.fromEntries([...actor.flags].map((flag) => [flag, true])),
      },
      "person",
      signal,
    ),
    enrollmentCounts(db, [id], signal).then((map) => map.get(id) ?? countsFromRows([])),
    db
      .select({ postalAddress: campaignSettings.postalAddress })
      .from(campaignSettings)
      .where(eq(campaignSettings.id, 1))
      .limit(1),
  ]);

  return {
    id: sequence.id,
    name: sequence.name,
    status: sequence.status,
    senderId: sequence.senderId,
    replyTo: sequence.replyTo,
    entry: parsedOrDefault(sequenceEntrySchema, sequence.entry, DEFAULT_SEQUENCE_ENTRY),
    exit: parsedOrDefault(sequenceExitSchema, sequence.exit, DEFAULT_SEQUENCE_EXIT),
    sendWindow: parsedOrDefault(sendWindowSchema, sequence.sendWindow, DEFAULT_SEND_WINDOW),
    steps: stepRows.map((step) => ({
      id: step.id,
      position: step.position,
      kind: step.kind === "wait" ? "wait" : "email",
      subject: step.subject,
      preheader: step.preheader,
      content:
        step.kind === "email"
          ? parsedOrDefault(campaignDocumentSchema, step.content, defaultSequenceEmailContent())
          : null,
      waitMinutes: step.waitMinutes,
      stats:
        step.kind === "email" && step.campaignId !== null
          ? stepStats(totalsById.get(step.campaignId))
          : null,
    })),
    senders,
    savedFilters: filters.map((filter) => ({ id: filter.id, name: filter.name })),
    enrollments: counts,
    hasPostalAddress: (settings?.postalAddress ?? "").trim() !== "",
  };
}
