import type { PgBoss } from "pg-boss";
import { PGBOSS_QUEUE_CAMPAIGN_SEND, PGBOSS_QUEUE_CAMPAIGN_START } from "@/constants/jobNames";
import { db as prodDb } from "@/db/client";
import { getBoss } from "@/jobs/boss";
import { runCampaignTick, snapshotCampaign } from "./batch";

// pg-boss wiring for the campaign engine. One tick job per campaign; every tick reschedules itself
// until no queued recipients remain.

export async function enqueueCampaignTick(campaignId: string, delaySeconds = 0): Promise<void> {
  const boss = getBoss();
  if (boss === null) return;
  const options = delaySeconds > 0 ? { startAfter: delaySeconds } : undefined;
  await boss.send(PGBOSS_QUEUE_CAMPAIGN_SEND, { campaignId }, options);
}

export async function enqueueCampaignStart(campaignId: string, at: Date): Promise<void> {
  const boss = getBoss();
  if (boss === null) return;
  const delaySeconds = Math.max(0, Math.ceil((at.getTime() - Date.now()) / 1000));
  await boss.send(PGBOSS_QUEUE_CAMPAIGN_START, { campaignId }, { startAfter: delaySeconds });
}

export async function registerCampaignJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_CAMPAIGN_SEND);
  await boss.createQueue(PGBOSS_QUEUE_CAMPAIGN_START);
  await boss.work(PGBOSS_QUEUE_CAMPAIGN_SEND, async ([job]) => {
    if (job === undefined) return;
    const campaignId = (job.data as { campaignId?: string }).campaignId;
    if (campaignId === undefined) return;
    const result = await runCampaignTick(prodDb, campaignId, AbortSignal.timeout(120_000)).catch(
      () => null,
    );
    if (result === null || !result.ok) return;
    if (result.value.nextAt !== null) {
      const delay = Math.max(1, Math.ceil((result.value.nextAt.getTime() - Date.now()) / 1000));
      await enqueueCampaignTick(campaignId, delay);
    }
  });
  await boss.work(PGBOSS_QUEUE_CAMPAIGN_START, async ([job]) => {
    if (job === undefined) return;
    const campaignId = (job.data as { campaignId?: string }).campaignId;
    if (campaignId === undefined) return;
    const signal = AbortSignal.timeout(120_000);
    const snapshot = await snapshotCampaign(prodDb, campaignId, signal).catch(() => null);
    if (snapshot === null || !snapshot.ok) return;
    await enqueueCampaignTick(campaignId);
  });
}
