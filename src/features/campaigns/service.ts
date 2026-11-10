import { desc, eq, sql } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { campaignSenders, campaignSettings, campaigns, users } from "@/db/schema";
import { can } from "@/features/permissions/can";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import type { CampaignCreateInput, CampaignUpdateInput } from "./schemas";
import { listSenders } from "./senders";

// Campaign CRUD (3.1). A sent campaign is read-only; drafts and scheduled campaigns can be edited.
// The list and editor read through the router, mutations through server actions.

export interface CampaignListRow {
  id: string;
  name: string;
  type: string;
  status: string;
  subject: string;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  ownerName: string | null;
  totals: {
    recipients?: number;
    sent?: number;
    delivered?: number;
    uniqueHumanOpens?: number;
    uniqueClicks?: number;
  };
  openRate: number | null;
  clickRate: number | null;
  sendingPercent: number | null;
}

export async function listCampaigns(db: Db, signal: AbortSignal): Promise<CampaignListRow[]> {
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      status: campaigns.status,
      subject: campaigns.subject,
      scheduledAt: campaigns.scheduledAt,
      startedAt: campaigns.startedAt,
      finishedAt: campaigns.finishedAt,
      createdAt: campaigns.createdAt,
      totals: campaigns.totals,
      ownerName: users.name,
    })
    .from(campaigns)
    .leftJoin(users, sql`${users.id} = coalesce(${campaigns.sendAsUserId}, ${campaigns.createdBy})`)
    // A sequence step's nurture campaign is internal: it appears in the sequence editor's per-step
    // stats, never in the campaign list.
    .where(sql`not exists (select 1 from sequence_steps ss where ss.campaign_id = ${campaigns.id})`)
    .orderBy(desc(campaigns.createdAt));
  signal.throwIfAborted();
  return rows.map((row) => {
    const totals = row.totals as CampaignListRow["totals"] | null;
    const delivered = totals?.delivered ?? 0;
    const recipients = totals?.recipients ?? 0;
    const sent = totals?.sent ?? 0;
    return {
      ...row,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      ownerName: row.ownerName ?? null,
      totals: totals ?? {},
      openRate: delivered === 0 ? null : (totals?.uniqueHumanOpens ?? 0) / delivered,
      clickRate: delivered === 0 ? null : (totals?.uniqueClicks ?? 0) / delivered,
      sendingPercent:
        row.status === "sending" && recipients > 0
          ? Math.min(100, Math.round((sent / recipients) * 100))
          : null,
    };
  });
}

export async function getCampaign(db: Db, id: string, signal: AbortSignal) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  signal.throwIfAborted();
  return row ?? null;
}

// Sender verification and the postal address are part of the Review checklist, so the editor reads
// them with the campaign instead of making three calls.
export async function getCampaignEditorView(db: Db, id: string, signal: AbortSignal) {
  const campaign = await getCampaign(db, id, signal);
  if (campaign === null) return null;
  const [sender] =
    campaign.senderId === null
      ? []
      : await db
          .select({ verifiedAt: campaignSenders.verifiedAt })
          .from(campaignSenders)
          .where(eq(campaignSenders.id, campaign.senderId))
          .limit(1);
  const [settings] = await db
    .select({ postalAddress: campaignSettings.postalAddress })
    .from(campaignSettings)
    .where(eq(campaignSettings.id, 1))
    .limit(1);
  return {
    campaign: {
      ...campaign,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      finishedAt: campaign.finishedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      totals: campaign.totals as { recipients?: number },
    },
    senderVerified: sender?.verifiedAt !== null && sender?.verifiedAt !== undefined,
    senders: await listSenders(db, signal),
    postalAddress: settings?.postalAddress ?? "",
  };
}

function deny(actor: PermSetUser): AppError {
  return new AppError(ERROR_IDS.PERM_DENIED, "campaigns.edit required", { userId: actor.id });
}

export async function createCampaign(
  db: Db,
  actor: PermSetUser,
  input: CampaignCreateInput,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const [row] = await db
    .insert(campaigns)
    .values({
      name: input.name,
      type: input.type,
      subject: input.subject,
      preheader: input.preheader,
      templateId: input.templateId,
      content: input.content,
      createdBy: actor.id,
    })
    .returning({ id: campaigns.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "campaign insert returned no row"));
  }
  return ok({ id: row.id });
}

export async function updateCampaign(
  db: Db,
  actor: PermSetUser,
  input: CampaignUpdateInput,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const current = await getCampaign(db, input.id, signal);
  if (current === null) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", { id: input.id }));
  }
  if (current.status === "sent") {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "a sent campaign is read-only", {}));
  }

  const [row] = await db
    .update(campaigns)
    .set({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.subject === undefined ? {} : { subject: input.subject }),
      ...(input.preheader === undefined ? {} : { preheader: input.preheader }),
      ...(input.senderId === undefined ? {} : { senderId: input.senderId }),
      ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
      ...(input.segment === undefined ? {} : { segment: input.segment }),
      ...(input.content === undefined ? {} : { content: input.content }),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, input.id))
    .returning({ id: campaigns.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", { id: input.id }));
  }
  return ok({ id: row.id });
}

export async function duplicateCampaign(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<{ id: string }, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const current = await getCampaign(db, id, signal);
  if (current === null) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", { id }));
  }
  const [row] = await db
    .insert(campaigns)
    .values({
      name: `${current.name} copy`.slice(0, 120),
      type: current.type,
      subject: current.subject,
      preheader: current.preheader,
      senderId: current.senderId,
      replyTo: current.replyTo,
      segment: current.segment,
      content: current.content,
      createdBy: actor.id,
    })
    .returning({ id: campaigns.id });
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INSERT_FAILED, "campaign copy insert returned no row"));
  }
  return ok({ id: row.id });
}

export async function deleteCampaign(
  db: Db,
  actor: PermSetUser,
  id: string,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  signal.throwIfAborted();
  if (!can(actor, "campaigns.edit")) return err(deny(actor));
  const current = await getCampaign(db, id, signal);
  if (current === null) {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_FOUND, "campaign not found", { id }));
  }
  if (current.status !== "draft" && current.status !== "cancelled") {
    return err(new AppError(ERROR_IDS.CAMPAIGN_NOT_SENDABLE, "only a draft can be deleted", {}));
  }
  await db.delete(campaigns).where(eq(campaigns.id, id));
  return ok(undefined);
}
