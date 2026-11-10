import { and, eq, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { AppError } from "@/constants/errorIds";
import { CAMPAIGN_BOUNCE_CRON, PGBOSS_QUEUE_CAMPAIGN_BOUNCE } from "@/constants/jobNames";
import type { Db } from "@/db/client";
import { db as defaultDb } from "@/db/client";
import {
  campaignEvents,
  campaignRecipients,
  campaignSettings,
  campaigns,
  personMarketing,
} from "@/db/schema";
import { getMailTransportFactory } from "@/features/mail/transport/factory";
import type {
  FetchedSource,
  ImapCredentials,
  ImapSession,
  MailTransportFactory,
} from "@/features/mail/transport/types";
import { transitionMarketingStatus } from "@/features/marketing/service";
import { hashEmail } from "@/features/marketing/suppression";
import { ok, type Result } from "@/types/result";
import { recordCampaignBounce, recordCampaignComplaint } from "../tracking/events";
import { bounceMailboxConfigured, bounceMailboxCredentials } from "./config";
import { type BounceReport, parseBounceReport } from "./dsn";

// 6.8's optional bounce mailbox. Every ten minutes it reads unseen INBOX reports, applies the 6.2
// transition, marks the message seen and moves it to Processed. With the four env values unset the
// job is not registered at all; a half-configured mailbox is the same as unconfigured.

const BOUNCE_MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const PROCESSED_FOLDER = "Processed";

export interface BounceRunSummary {
  configured: boolean;
  processed: number;
  ignored: number;
}

export interface BounceMailboxOptions {
  credentials?: ImapCredentials | null;
  factory?: MailTransportFactory;
  now?: () => Date;
}

export async function runBounceMailbox(
  db: Db,
  signal: AbortSignal,
  options: BounceMailboxOptions = {},
): Promise<Result<BounceRunSummary, AppError>> {
  const credentials = options.credentials ?? bounceMailboxCredentials();
  if (credentials === null) return ok({ configured: false, processed: 0, ignored: 0 });
  const factory = options.factory ?? getMailTransportFactory();
  const now = options.now?.() ?? new Date();

  const opened = await factory.openImap(credentials, signal);
  if (!opened.ok) return opened;
  const session = opened.value;
  try {
    const folder = await ensureProcessedFolder(session, signal);
    if (!folder.ok) return folder;

    const unseen = await session.listUnseen("INBOX", signal);
    if (!unseen.ok) return unseen;
    if (unseen.value.length === 0) {
      await saveRunState(db, now, 0, signal);
      return ok({ configured: true, processed: 0, ignored: 0 });
    }

    const fetched = await session.fetchSources(
      "INBOX",
      unseen.value,
      BOUNCE_MAX_MESSAGE_BYTES,
      signal,
    );
    if (!fetched.ok) return fetched;

    const outcome = await processSources(db, fetched.value, signal);
    if (!outcome.ok) return outcome;

    // Seen first, then move: if the move fails the report is not fetched again, so a retry cannot
    // double-apply a hard bounce or a complaint.
    const seen = await session.markSeen(
      "INBOX",
      fetched.value.map((source) => source.uid),
      signal,
    );
    if (!seen.ok) return seen;
    if (outcome.value.moved.length > 0) {
      const moved = await session.move("INBOX", outcome.value.moved, PROCESSED_FOLDER, signal);
      if (!moved.ok) return moved;
    }

    await saveRunState(db, now, outcome.value.processed, signal);
    return ok({
      configured: true,
      processed: outcome.value.processed,
      ignored: outcome.value.ignored,
    });
  } finally {
    await session.close();
  }
}

async function ensureProcessedFolder(
  session: ImapSession,
  signal: AbortSignal,
): Promise<Result<void, AppError>> {
  const folders = await session.listFolders(signal);
  if (!folders.ok) return folders;
  const exists = folders.value.some(
    (folder) => folder.path.toLowerCase() === PROCESSED_FOLDER.toLowerCase(),
  );
  if (exists) return ok(undefined);
  return session.createFolder(PROCESSED_FOLDER, signal);
}

interface ProcessOutcome {
  processed: number;
  ignored: number;
  moved: number[];
}

async function processSources(
  db: Db,
  sources: FetchedSource[],
  signal: AbortSignal,
): Promise<Result<ProcessOutcome, AppError>> {
  const moved: number[] = [];
  let processed = 0;
  let ignored = 0;
  for (const source of sources) {
    signal.throwIfAborted();
    const report =
      source.source === null ? null : await parseBounceReport(source.source).catch(() => null);
    if (report === null) {
      ignored += 1;
      continue;
    }
    const applied = await applyBounceReport(db, report, signal);
    if (!applied.ok) {
      console.warn("campaign bounce report failed", { error: applied.error.id });
      ignored += 1;
      continue;
    }
    if (!applied.value.applied) {
      ignored += 1;
      continue;
    }
    processed += 1;
    moved.push(source.uid);
  }
  return ok({ processed, ignored, moved });
}

async function saveRunState(
  db: Db,
  at: Date,
  processed: number,
  signal: AbortSignal,
): Promise<void> {
  await db
    .insert(campaignSettings)
    .values({ id: 1, bounceLastRunAt: at, bounceLastProcessed: processed })
    .onConflictDoUpdate({
      target: campaignSettings.id,
      set: { bounceLastRunAt: at, bounceLastProcessed: processed, updatedAt: at },
    });
  signal.throwIfAborted();
}

interface RecipientRow {
  campaignId: string;
  recipientId: string;
  personId: string | null;
  status: string;
  campaignName: string;
}

async function findRecipient(
  db: Db,
  report: BounceReport,
  signal: AbortSignal,
): Promise<RecipientRow | null> {
  const select = {
    campaignId: campaignRecipients.campaignId,
    recipientId: campaignRecipients.id,
    personId: campaignRecipients.personId,
    status: campaignRecipients.status,
    campaignName: campaigns.name,
  };
  if (report.recipientId !== null) {
    const [row] = await db
      .select(select)
      .from(campaignRecipients)
      .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
      .where(eq(campaignRecipients.id, report.recipientId))
      .limit(1);
    signal.throwIfAborted();
    if (row !== undefined && (report.campaignId === null || row.campaignId === report.campaignId)) {
      return row;
    }
  }
  if (report.campaignId === null || report.recipientEmail === null) return null;
  const [row] = await db
    .select(select)
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(
      and(
        eq(campaignRecipients.campaignId, report.campaignId),
        eq(campaignRecipients.emailHash, hashEmail(report.recipientEmail)),
      ),
    )
    .limit(1);
  signal.throwIfAborted();
  return row ?? null;
}

async function hasEvent(
  db: Db,
  recipientId: string,
  type: "bounce_hard" | "complaint",
  signal: AbortSignal,
): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignEvents)
    .where(and(eq(campaignEvents.recipientId, recipientId), eq(campaignEvents.type, type)));
  signal.throwIfAborted();
  return (row?.count ?? 0) > 0;
}

export async function applyBounceReport(
  db: Db,
  report: BounceReport,
  signal: AbortSignal,
): Promise<Result<{ applied: boolean }, AppError>> {
  const recipient = await findRecipient(db, report, signal);
  if (recipient === null || recipient.personId === null) return ok({ applied: false });

  if (report.kind === "complaint") {
    if (await hasEvent(db, recipient.recipientId, "complaint", signal)) {
      return ok({ applied: false });
    }
    await recordCampaignComplaint(
      db,
      {
        campaignId: recipient.campaignId,
        recipientId: recipient.recipientId,
        personId: recipient.personId,
        campaignName: recipient.campaignName,
      },
      signal,
    );
    await transitionMarketingStatus(
      db,
      {
        personId: recipient.personId,
        to: "unsubscribed",
        source: "complaint",
        campaignId: recipient.campaignId,
      },
      signal,
    );
    return ok({ applied: true });
  }

  if (report.severity === "hard") {
    if (await hasEvent(db, recipient.recipientId, "bounce_hard", signal)) {
      return ok({ applied: false });
    }
    await db
      .update(campaignRecipients)
      .set({ status: "bounced_hard" })
      .where(eq(campaignRecipients.id, recipient.recipientId));
    await recordCampaignBounce(
      db,
      {
        campaignId: recipient.campaignId,
        recipientId: recipient.recipientId,
        personId: recipient.personId,
        campaignName: recipient.campaignName,
        type: "bounce_hard",
      },
      signal,
    );
    await transitionMarketingStatus(
      db,
      {
        personId: recipient.personId,
        to: "bounced",
        source: "bounce",
        campaignId: recipient.campaignId,
      },
      signal,
    );
    return ok({ applied: true });
  }

  if (report.severity === "soft") {
    await db
      .update(campaignRecipients)
      .set({ status: "failed_soft" })
      .where(eq(campaignRecipients.id, recipient.recipientId));
    await recordCampaignBounce(
      db,
      {
        campaignId: recipient.campaignId,
        recipientId: recipient.recipientId,
        personId: recipient.personId,
        campaignName: recipient.campaignName,
        type: "bounce_soft",
      },
      signal,
    );
    await incrementSoftBounce(db, recipient, signal);
    return ok({ applied: true });
  }

  return ok({ applied: false });
}

// 6.2: the third soft bounce in a row moves the person to bounced. A soft bounce while already
// unsubscribed or bounced changes nothing.
async function incrementSoftBounce(
  db: Db,
  recipient: RecipientRow,
  signal: AbortSignal,
): Promise<void> {
  if (recipient.personId === null) return;
  const [marketing] = await db
    .select()
    .from(personMarketing)
    .where(eq(personMarketing.personId, recipient.personId))
    .limit(1);
  signal.throwIfAborted();
  const status = marketing?.status ?? "not_subscribed";
  if (status !== "subscribed" && status !== "pending") return;
  const next = (marketing?.softBounceCount ?? 0) + 1;
  await db
    .update(personMarketing)
    .set({ softBounceCount: next })
    .where(eq(personMarketing.personId, recipient.personId));
  if (next >= 3) {
    await transitionMarketingStatus(
      db,
      {
        personId: recipient.personId,
        to: "bounced",
        source: "bounce",
        campaignId: recipient.campaignId,
      },
      signal,
    );
  }
}

export async function registerCampaignBounceJob(boss: PgBoss): Promise<void> {
  if (!bounceMailboxConfigured()) return;
  await boss.createQueue(PGBOSS_QUEUE_CAMPAIGN_BOUNCE);
  await boss.work(PGBOSS_QUEUE_CAMPAIGN_BOUNCE, async () => {
    await runBounceMailbox(defaultDb, AbortSignal.timeout(120_000)).catch((error: unknown) => {
      console.warn("campaign bounce mailbox run failed", { error });
    });
  });
  await boss.schedule(PGBOSS_QUEUE_CAMPAIGN_BOUNCE, CAMPAIGN_BOUNCE_CRON);
}
