import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { EMAIL_JOB_RETRY_LIMIT, PGBOSS_QUEUE_MAIL_BACKFILL } from "@/constants/jobNames";
import {
  MAIL_BACKFILL_MAX_PER_RUN,
  MAIL_BACKFILL_WINDOW_DAYS,
  type SpecialUse,
} from "@/constants/mail";
import type { Db } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { hydrateOwner } from "@/features/email/syncCursor";
import type { AuthUser } from "@/features/permissions/types";
import { requireBoss } from "@/jobs/requireBoss";
import { ok, type Result } from "@/types/result";
import { loadImapCredentials } from "../connect/credentials";
import { getMailTransportFactory } from "../transport/factory";
import type { ImapSession, MailTransportFactory } from "../transport/types";
import { applyFolderMessages } from "./applyInbound";
import { getCursors, upsertCursor } from "./cursors";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_WINDOW_USES: readonly SpecialUse[] = ["inbox", "sent", "archive"];

export interface BackfillResult {
  applied: number;
  // True when at least one folder still has older mail to walk.
  remaining: boolean;
}

// Queue one backfill pass for an account, deduped per mailbox.
export async function enqueueBackfillJob(accountId: string): Promise<void> {
  const boss = requireBoss();
  if (boss === null) return;
  await boss.send(
    PGBOSS_QUEUE_MAIL_BACKFILL,
    { accountId },
    { singletonKey: accountId, retryLimit: EMAIL_JOB_RETRY_LIMIT },
  );
}

interface BackfillDeps {
  transports: MailTransportFactory;
}

async function backfillFolder(
  db: Db,
  session: ImapSession,
  account: { id: string; emailAddress: string },
  owner: AuthUser,
  cursor: Awaited<ReturnType<typeof getCursors>>[number],
  before: Date,
  clamp: Date,
  signal: AbortSignal,
): Promise<Result<{ applied: number; done: boolean }, AppError>> {
  const windowStart = new Date(before.getTime() - MAIL_BACKFILL_WINDOW_DAYS * DAY_MS);
  const finalWindow = windowStart <= clamp;
  const since = finalWindow ? clamp : windowStart;

  const listed = await session.uidsInRange(cursor.folder, since, before, signal);
  if (!listed.ok) return listed;
  const ordered = [...listed.value].sort((a, b) => a - b);
  const batch = ordered.slice(0, MAIL_BACKFILL_MAX_PER_RUN);
  const partial = ordered.length > batch.length;

  const stored = await applyFolderMessages({
    db,
    account,
    owner,
    session,
    folder: cursor.folder,
    uidValidity: cursor.uidValidity,
    uids: batch,
    signal,
  });
  if (!stored.ok) return stored;

  const done = finalWindow && !partial;
  const nextBefore = partial ? (stored.value.oldestMessageDate ?? since) : since;
  await upsertCursor(db, {
    ...cursor,
    backfillBefore: done ? null : nextBefore,
    backfillDone: done,
  });
  return ok({ applied: stored.value.applied, done });
}

// Walk older mail back in 90-day windows. A window with more than MAIL_BACKFILL_MAX_PER_RUN
// messages is applied oldest-first; the cursor ceiling then moves to the earliest processed
// internal date, so the next run continues below it instead of re-reading the same window.
export async function runBackfillJob(
  db: Db,
  accountId: string,
  signal: AbortSignal,
  deps: BackfillDeps = { transports: getMailTransportFactory() },
): Promise<Result<BackfillResult, AppError>> {
  signal.throwIfAborted();
  const [account] = await db
    .select({
      id: emailAccounts.id,
      emailAddress: emailAccounts.emailAddress,
      userId: emailAccounts.userId,
    })
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);
  if (account === undefined) return ok({ applied: 0, remaining: false });

  const credentials = await loadImapCredentials(db, accountId, signal);
  if (!credentials.ok) return credentials;
  if (credentials.value === null) return ok({ applied: 0, remaining: false });

  const owner = await hydrateOwner(db, account.userId, signal);
  if (!owner.ok) return owner;

  const opened = await deps.transports.openImap(credentials.value.imap, signal);
  if (!opened.ok) return opened;

  try {
    const cursors = await getCursors(db, accountId);
    const clamp = new Date(Date.now() - env.MAIL_BACKFILL_DAYS * DAY_MS);
    let applied = 0;
    let remaining = false;

    for (const cursor of cursors) {
      signal.throwIfAborted();
      if (cursor.backfillDone || cursor.backfillBefore === null) continue;
      if (cursor.specialUse === null || !DATE_WINDOW_USES.includes(cursor.specialUse)) continue;

      const result = await backfillFolder(
        db,
        opened.value,
        { id: account.id, emailAddress: account.emailAddress },
        owner.value,
        cursor,
        cursor.backfillBefore,
        clamp,
        signal,
      );
      if (!result.ok) return result;
      applied += result.value.applied;
      if (!result.value.done) remaining = true;
    }

    return ok({ applied, remaining });
  } finally {
    await opened.value.close();
  }
}

// Register the backfill queue and its handler. A pass that still has older mail re-enqueues
// itself with a 30 s delay so the mailbox is never hammered.
export async function registerMailBackfillWorker(boss: PgBoss): Promise<void> {
  const { db } = await import("@/db/client");
  await boss.createQueue(PGBOSS_QUEUE_MAIL_BACKFILL);
  await boss.work(
    PGBOSS_QUEUE_MAIL_BACKFILL,
    async ([job]: Array<{ data: { accountId: string } }>) => {
      if (job === undefined) return;
      const signal = AbortSignal.timeout(120_000);
      const result = await runBackfillJob(db, job.data.accountId, signal);
      if (!result.ok) {
        throw new AppError(ERROR_IDS.MAIL_IMAP_FAILED, "backfill job failed", {
          accountId: job.data.accountId,
        });
      }
      if (result.value.remaining) {
        await boss.send(
          PGBOSS_QUEUE_MAIL_BACKFILL,
          { accountId: job.data.accountId },
          { startAfter: 30 },
        );
      }
    },
  );
}
