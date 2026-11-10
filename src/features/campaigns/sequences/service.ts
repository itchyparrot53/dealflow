import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import type * as schema from "@/db/schema";
import {
  campaigns,
  sequenceEnrollments,
  sequenceSegmentMembers,
  sequenceSteps,
  sequences,
} from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { loadCampaignAssetUrls } from "../assets";
import type { CampaignDocument } from "../blocks/schema";
import { freezeCampaignLinks, loadVerifiedCampaignSender } from "../send/batch";
import { getCampaignSettings } from "../settings";
import { type SequenceInput, type SequenceStepInput, sequenceInputSchema } from "./model";

// 6.10's sequence store. A sequence is a small state machine plus its hidden nurture campaigns (one
// per email step), created and refreshed whenever the definition is saved or activated. The
// scheduler only reads what this module has already made sendable.

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

function deny(actor: PermSetUser, flag: "campaigns.edit" | "campaigns.send"): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, `${flag} required`, { userId: actor.id });
}

function invalid(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, message, context);
}

function parseInput(raw: unknown): Result<SequenceInput, AppError> {
  const parsed = sequenceInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "sequence definition is invalid", {
        issues: parsed.error.issues.length,
      }),
    );
  }
  return ok(parsed.data);
}

async function insertSteps(
  tx: Tx,
  sequenceId: string,
  steps: readonly SequenceStepInput[],
): Promise<void> {
  if (steps.length === 0) return;
  await tx.insert(sequenceSteps).values(
    steps.map((step, position) => ({
      sequenceId,
      position,
      kind: step.kind,
      subject: step.kind === "email" ? step.subject : null,
      preheader: step.kind === "email" ? (step.preheader ?? null) : null,
      content: step.kind === "email" ? step.content : null,
      waitMinutes: step.kind === "wait" ? step.waitMinutes : null,
    })),
  );
}

function stepColumns(step: SequenceStepInput) {
  return {
    kind: step.kind,
    subject: step.kind === "email" ? step.subject : null,
    preheader: step.kind === "email" ? (step.preheader ?? null) : null,
    content: step.kind === "email" ? step.content : null,
    waitMinutes: step.kind === "wait" ? step.waitMinutes : null,
  };
}

async function applyStep(
  tx: Tx,
  sequenceId: string,
  position: number,
  step: SequenceStepInput,
  current: typeof sequenceSteps.$inferSelect | undefined,
): Promise<string | null> {
  if (current === undefined) {
    const [inserted] = await tx
      .insert(sequenceSteps)
      .values({ sequenceId, position, ...stepColumns(step) })
      .returning({ id: sequenceSteps.id });
    return inserted?.id ?? null;
  }
  const lostCampaign = current.kind === "email" && step.kind === "wait";
  await tx
    .update(sequenceSteps)
    .set({
      position,
      ...stepColumns(step),
      campaignId: lostCampaign ? null : current.campaignId,
    })
    .where(eq(sequenceSteps.id, current.id));
  if (lostCampaign && current.campaignId !== null) {
    await tx.delete(campaigns).where(eq(campaigns.id, current.campaignId));
  }
  return current.id;
}

async function deleteRemovedSteps(
  tx: Tx,
  removed: (typeof sequenceSteps.$inferSelect)[],
): Promise<void> {
  if (removed.length === 0) return;
  const campaignIds = removed
    .map((row) => row.campaignId)
    .filter((id): id is string => id !== null);
  if (campaignIds.length > 0) {
    await tx.delete(campaigns).where(inArray(campaigns.id, campaignIds));
  }
  await tx.delete(sequenceSteps).where(
    inArray(
      sequenceSteps.id,
      removed.map((row) => row.id),
    ),
  );
}

async function replaceSteps(
  tx: Tx,
  sequenceId: string,
  steps: readonly SequenceStepInput[],
): Promise<void> {
  const existing = await tx
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId));
  const byId = new Map(existing.map((row) => [row.id, row]));
  const keep = new Set<string>();
  // Bump positions out of the unique index's range before assigning final ones, so a reorder can
  // never collide with a row that has not moved yet.
  await tx
    .update(sequenceSteps)
    .set({ position: sql`${sequenceSteps.position} + 1000` })
    .where(eq(sequenceSteps.sequenceId, sequenceId));
  for (const [position, step] of steps.entries()) {
    const current = step.id === undefined ? undefined : byId.get(step.id);
    const id = await applyStep(tx, sequenceId, position, step, current);
    if (id !== null) keep.add(id);
  }
  await deleteRemovedSteps(
    tx,
    existing.filter((row) => !keep.has(row.id)),
  );
}

// Create or refresh one hidden nurture campaign per email step. The campaign is linked from the
// step (sequence_steps.campaign_id), so the campaigns list can hide it and the sequence editor can
// read its totals as the step's stats.
export async function syncSequenceCampaigns(
  tx: Tx,
  sequenceId: string,
  signal: AbortSignal,
): Promise<void> {
  const [sequence] = await tx.select().from(sequences).where(eq(sequences.id, sequenceId));
  if (sequence === undefined) return;
  const steps = await tx
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(sequenceSteps.position);
  const emailSteps = steps.filter((step) => step.kind === "email");
  if (emailSteps.length === 0) return;

  const design = await getEmailDesign(tx, signal);
  const settings = await getCampaignSettings(tx, signal);
  const assetUrls = await loadCampaignAssetUrls(tx, signal);
  const status = sequence.status === "draft" ? "draft" : "sending";

  for (const step of emailSteps) {
    if (step.content === null) continue;
    const values = {
      name: `${sequence.name} step ${step.position + 1}`.slice(0, 120),
      type: "nurture",
      status,
      subject: step.subject ?? "Sequence email",
      preheader: step.preheader,
      senderId: sequence.senderId,
      replyTo: sequence.replyTo,
      content: step.content,
      sendAsUserId: sequence.createdBy,
    };
    let campaignId = step.campaignId;
    if (campaignId === null) {
      const [created] = await tx
        .insert(campaigns)
        .values({
          ...values,
          createdBy: sequence.createdBy,
          startedAt: status === "sending" ? new Date() : null,
        })
        .returning({ id: campaigns.id });
      if (created === undefined) {
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "sequence campaign insert returned no row");
      }
      campaignId = created.id;
      await tx.update(sequenceSteps).set({ campaignId }).where(eq(sequenceSteps.id, step.id));
    } else {
      await tx.update(campaigns).set(values).where(eq(campaigns.id, campaignId));
    }
    await freezeCampaignLinks(
      tx,
      campaignId,
      step.content as CampaignDocument,
      {
        design,
        postalAddress: settings.postalAddress,
        baseUrl: env.BASE_URL,
        assetUrls,
      },
      signal,
    );
  }
}

export async function createSequence(
  db: Db,
  actor: PermSetUser,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  if (!can(actor, "campaigns.edit")) return err(deny(actor, "campaigns.edit"));
  const parsed = parseInput(raw);
  if (!parsed.ok) return parsed;
  const input = parsed.value;
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sequences)
      .values({
        name: input.name,
        status: "draft",
        senderId: input.senderId,
        replyTo: input.replyTo,
        entry: input.entry,
        exit: input.exit,
        sendWindow: input.sendWindow,
        createdBy: actor.id,
      })
      .returning({ id: sequences.id });
    if (row === undefined) {
      return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "sequence insert returned no row"));
    }
    await insertSteps(tx, row.id, input.steps);
    await syncSequenceCampaigns(tx, row.id, signal);
    return ok({ id: row.id });
  });
}

export async function updateSequence(
  db: Db,
  actor: PermSetUser,
  id: string,
  raw: unknown,
  signal: AbortSignal,
): Promise<Result<{ id: string; steps: { id: string; position: number }[] }, AppError>> {
  if (!can(actor, "campaigns.edit")) return err(deny(actor, "campaigns.edit"));
  const parsed = parseInput(raw);
  if (!parsed.ok) return parsed;
  const input = parsed.value;
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: sequences.id })
      .from(sequences)
      .where(eq(sequences.id, id))
      .for("update");
    if (current === undefined) {
      return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "sequence not found", { id }));
    }
    await tx
      .update(sequences)
      .set({
        name: input.name,
        senderId: input.senderId,
        replyTo: input.replyTo,
        entry: input.entry,
        exit: input.exit,
        sendWindow: input.sendWindow,
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, id));
    await replaceSteps(tx, id, input.steps);
    await syncSequenceCampaigns(tx, id, signal);
    const savedSteps = await tx
      .select({ id: sequenceSteps.id, position: sequenceSteps.position })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, id))
      .orderBy(sequenceSteps.position);
    return ok({ id, steps: savedSteps });
  });
}

export async function activateSequence(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  if (!can(actor, "campaigns.send")) return err(deny(actor, "campaigns.send"));
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const [sequence] = await tx.select().from(sequences).where(eq(sequences.id, id)).for("update");
    if (sequence === undefined) {
      return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "sequence not found", { id }));
    }
    const [step] = await tx
      .select({ id: sequenceSteps.id })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, id))
      .limit(1);
    if (step === undefined) return err(invalid("a sequence needs at least one step", { id }));

    const [emailStep] = await tx
      .select({ id: sequenceSteps.id })
      .from(sequenceSteps)
      .where(and(eq(sequenceSteps.sequenceId, id), eq(sequenceSteps.kind, "email")))
      .limit(1);
    if (emailStep !== undefined) {
      const sender = await loadVerifiedCampaignSender(tx, sequence.senderId, signal);
      if (sender === null) {
        return err(
          new AppError(ERROR_IDS.CAMPAIGN_SENDER_UNVERIFIED, "sender is not verified", { id }),
        );
      }
      const settings = await getCampaignSettings(tx, signal);
      if (settings.postalAddress.trim() === "") {
        return err(
          new AppError(ERROR_IDS.CAMPAIGN_ADDRESS_MISSING, "postal address is required", { id }),
        );
      }
    }
    await tx
      .update(sequences)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sequences.id, id));
    await syncSequenceCampaigns(tx, id, signal);
    const stepCampaigns = await tx
      .select({ id: sequenceSteps.campaignId })
      .from(sequenceSteps)
      .where(and(eq(sequenceSteps.sequenceId, id), eq(sequenceSteps.kind, "email")));
    const campaignIds = stepCampaigns
      .map((row) => row.id)
      .filter((value): value is string => value !== null);
    if (campaignIds.length > 0) {
      await tx
        .update(campaigns)
        .set({ status: "sending", startedAt: sql`coalesce(${campaigns.startedAt}, now())` })
        .where(inArray(campaigns.id, campaignIds));
    }
    return ok({ id });
  });
}

export async function pauseSequence(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  if (!can(actor, "campaigns.send")) return err(deny(actor, "campaigns.send"));
  signal.throwIfAborted();
  const [row] = await db
    .update(sequences)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(sequences.id, id))
    .returning({ id: sequences.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "sequence not found", { id }));
  }
  return ok(row);
}

export async function deleteSequence(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  if (!can(actor, "campaigns.edit")) return err(deny(actor, "campaigns.edit"));
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const steps = await tx
      .select({ campaignId: sequenceSteps.campaignId })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, id));
    const campaignIds = steps
      .map((step) => step.campaignId)
      .filter((value): value is string => value !== null);
    if (campaignIds.length > 0) {
      await tx.delete(campaigns).where(inArray(campaigns.id, campaignIds));
    }
    const [row] = await tx
      .delete(sequences)
      .where(eq(sequences.id, id))
      .returning({ id: sequences.id });
    if (row === undefined) {
      return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "sequence not found", { id }));
    }
    return ok(row);
  });
}

// Used by the sequence list's delete confirmation copy.
export async function sequenceEnrollmentCounts(
  db: Db,
  sequenceId: string,
  signal: AbortSignal,
): Promise<{ active: number; completed: number; exited: number; failed: number }> {
  const rows = await db
    .select({ status: sequenceEnrollments.status, count: sql<number>`count(*)::int` })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))
    .groupBy(sequenceEnrollments.status);
  signal.throwIfAborted();
  const counts = { active: 0, completed: 0, exited: 0, failed: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = row.count;
  }
  return counts;
}

// Segment entry memory: called by the fifteen-minute scan.
export async function segmentMemberIds(
  db: Db,
  sequenceId: string,
  signal: AbortSignal,
): Promise<Set<string>> {
  const rows = await db
    .select({ personId: sequenceSegmentMembers.personId })
    .from(sequenceSegmentMembers)
    .where(eq(sequenceSegmentMembers.sequenceId, sequenceId));
  signal.throwIfAborted();
  return new Set(rows.map((row) => row.personId));
}
