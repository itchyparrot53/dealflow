import { and, eq, inArray } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignRecipients, campaigns } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";

// 6.6's state actions. Every one checks campaigns.send; a sent campaign never changes state again.

async function requireCampaign(db: Db, id: string, signal: AbortSignal) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  signal.throwIfAborted();
  return row ?? null;
}

function deny(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "campaigns.send required", { userId: actor.id });
}

function notSendable(status: string): AppError {
  return new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "campaign cannot change state", { status });
}

export async function pauseCampaign(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ status: string }, AppError>> {
  if (!can(actor, "campaigns.send")) return err(deny(actor));
  const campaign = await requireCampaign(db, id, signal);
  if (campaign === null)
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", {}));
  if (campaign.status !== "sending") return err(notSendable(campaign.status));
  await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, id));
  return ok({ status: "paused" });
}

export async function resumeCampaign(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ status: string }, AppError>> {
  if (!can(actor, "campaigns.send")) return err(deny(actor));
  const campaign = await requireCampaign(db, id, signal);
  if (campaign === null)
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", {}));
  if (campaign.status !== "paused") return err(notSendable(campaign.status));
  await db.update(campaigns).set({ status: "sending" }).where(eq(campaigns.id, id));
  return ok({ status: "sending" });
}

export async function cancelCampaign(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ status: string }, AppError>> {
  if (!can(actor, "campaigns.send")) return err(deny(actor));
  const campaign = await requireCampaign(db, id, signal);
  if (campaign === null)
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", {}));
  if (!["scheduled", "sending", "paused"].includes(campaign.status)) {
    return err(notSendable(campaign.status));
  }
  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(eq(campaigns.id, id));
    await tx
      .update(campaignRecipients)
      .set({ status: "skipped_cancelled" })
      .where(
        and(
          eq(campaignRecipients.campaignId, id),
          inArray(campaignRecipients.status, ["queued", "sending"]),
        ),
      );
  });
  return ok({ status: "cancelled" });
}

// 6.6: schedule, send now. Scheduling requires campaigns.send and at least ten minutes of lead time.
export async function scheduleCampaign(
  db: Db,
  actor: PermSetUser,
  id: string,
  at: Date,
  signal: AbortSignal,
): Promise<Result<{ scheduledAt: string }, AppError>> {
  if (!can(actor, "campaigns.send")) return err(deny(actor));
  const campaign = await requireCampaign(db, id, signal);
  if (campaign === null)
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", {}));
  if (campaign.status !== "draft") return err(notSendable(campaign.status));
  if (at.getTime() < Date.now() + 10 * 60_000) {
    return err(
      new AppError(ERROR_IDS.CAMPAIGN_INPUT_INVALID, "schedule at least ten minutes ahead", {}),
    );
  }
  await db
    .update(campaigns)
    .set({ status: "scheduled", scheduledAt: at })
    .where(eq(campaigns.id, id));
  return ok({ scheduledAt: at.toISOString() });
}
