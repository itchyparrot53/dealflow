import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { env } from "@/config/env";
import { EMAIL_JOB_RETRY_LIMIT, PGBOSS_QUEUE_EMAIL_SYNC } from "@/constants/jobNames";
import { db } from "@/db/client";
import { pendingTicksVia } from "@/features/email/syncReEnqueue";
import { loadImapCredentials } from "../connect/credentials";
import { getMailTransportFactory } from "../transport/factory";

const BACKOFF_START_MS = 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;

interface LiveSession {
  controller: AbortController;
  close: () => Promise<void>;
}

interface AccountState {
  failures: number;
  nextAttemptAt: number;
}

export interface IdleManager {
  stop: () => Promise<void>;
}

// One IDLE connection per connected IMAP mailbox, so new mail triggers a sync in seconds instead
// of waiting for the poll. The regular poll keeps running for every folder; IDLE only nudges.
export function startIdleManager(boss: PgBoss, opts: { scanMs?: number } = {}): IdleManager {
  const scanMs = opts.scanMs ?? 60_000;
  const live = new Map<string, LiveSession>();
  const state = new Map<string, AccountState>();
  const unsupported = new Set<string>();
  const pendingTicks = pendingTicksVia(db);
  let stopped = false;
  // Read through a function: the flag changes from stop(), which control-flow analysis cannot
  // see, so a direct read would look permanently false to the linter.
  const isStopped = (): boolean => stopped;

  function recordFailure(accountId: string): void {
    const failures = (state.get(accountId)?.failures ?? 0) + 1;
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** (failures - 1));
    state.set(accountId, { failures, nextAttemptAt: Date.now() + delay });
  }

  async function nudgeSync(accountId: string): Promise<void> {
    try {
      if ((await pendingTicks(accountId)) > 0) return;
      await boss.send(
        PGBOSS_QUEUE_EMAIL_SYNC,
        { accountId },
        { singletonKey: accountId, retryLimit: EMAIL_JOB_RETRY_LIMIT },
      );
    } catch (error) {
      console.warn("[mail.idle] sync nudge failed", { accountId, error });
    }
  }

  async function openSession(accountId: string): Promise<void> {
    const credentials = await loadImapCredentials(db, accountId, AbortSignal.timeout(10_000));
    if (!credentials.ok || credentials.value === null) {
      recordFailure(accountId);
      return;
    }
    const opened = await getMailTransportFactory().openImap(
      credentials.value.imap,
      AbortSignal.timeout(30_000),
    );
    if (!opened.ok) {
      recordFailure(accountId);
      return;
    }
    const session = opened.value;
    if (!session.supportsIdle) {
      // The filesystem fake cannot hold a connection; the poll cadence covers it.
      unsupported.add(accountId);
      await session.close();
      return;
    }

    const controller = new AbortController();
    live.set(accountId, { controller, close: () => session.close() });
    void (async () => {
      try {
        const result = await session.idle(
          "INBOX",
          () => {
            void nudgeSync(accountId);
          },
          controller.signal,
        );
        if (!result.ok && !isStopped()) {
          console.warn("[mail.idle] session ended", { accountId, errorId: result.error.id });
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.warn("[mail.idle] session crashed", { accountId, error });
        }
      } finally {
        live.delete(accountId);
        await session.close().catch(() => undefined);
        if (!isStopped()) recordFailure(accountId);
      }
    })();
  }

  async function scan(): Promise<void> {
    if (isStopped()) return;
    try {
      const accounts = (
        await db.execute(sql`
          SELECT a.id FROM email_accounts a
          JOIN mail_account_credentials c ON c.account_id = a.id
          WHERE a.status = 'connected'
          ORDER BY a.created_at
          LIMIT ${env.MAIL_IDLE_MAX}
        `)
      ).rows as { id: string }[];
      const connected = new Set(accounts.map((account) => account.id));

      for (const [accountId, session] of live) {
        if (connected.has(accountId)) continue;
        session.controller.abort();
        await session.close().catch(() => undefined);
        live.delete(accountId);
      }

      for (const account of accounts) {
        if (isStopped() || live.has(account.id) || unsupported.has(account.id)) continue;
        const backoff = state.get(account.id);
        if (backoff !== undefined && Date.now() < backoff.nextAttemptAt) continue;
        await openSession(account.id);
      }
    } catch (error) {
      console.warn("[mail.idle] scan failed", { error });
    }
  }

  const timer = setInterval(() => {
    void scan();
  }, scanMs);
  void scan();

  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      for (const session of live.values()) {
        session.controller.abort();
        await session.close().catch(() => undefined);
      }
      live.clear();
    },
  };
}
