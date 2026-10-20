import { and, eq, inArray, sql } from "drizzle-orm";
import { env } from "@/config/env";
import type { AppError } from "@/constants/errorIds";
import { MAIL_RELIST_MINUTES, type SpecialUse } from "@/constants/mail";
import type { Db } from "@/db/client";
import { emailMessages } from "@/db/schema";
import type { AuthUser } from "@/features/permissions/types";
import { ok, type Result } from "@/types/result";
import type { ImapSession } from "../transport/types";
import { applyFolderMessages } from "./applyInbound";
import { enqueueBackfillJob } from "./backfill";
import { deleteFolderState, type FolderCursor, getCursors, upsertCursor } from "./cursors";
import { discoverFolders } from "./folders";
import { deleteLocations, folderLocations } from "./locations";
import { reconcileTrash } from "./trashState";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SyncAccount {
  id: string;
  emailAddress: string;
}

export interface SyncDeps {
  enqueueBackfill: (accountId: string) => Promise<void>;
}

export interface SyncResult {
  applied: number;
}

function defaultEnqueueBackfill(accountId: string): Promise<void> {
  return enqueueBackfillJob(accountId);
}

function shouldBackfill(): boolean {
  return env.MAIL_BACKFILL_DAYS > env.MAIL_INITIAL_SYNC_DAYS;
}

function initialWindowStart(): Date {
  return new Date(Date.now() - env.MAIL_INITIAL_SYNC_DAYS * DAY_MS);
}

function usesDateWindow(use: SpecialUse): boolean {
  return use === "inbox" || use === "sent" || use === "archive";
}

async function threadIdsFor(
  db: Db,
  accountId: string,
  providerMessageIds: string[],
): Promise<string[]> {
  if (providerMessageIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ threadId: emailMessages.threadId })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.accountId, accountId),
        inArray(emailMessages.providerMessageId, providerMessageIds),
      ),
    );
  return rows.map((row) => row.threadId);
}

// First pass for one folder: the newer window (or everything for junk and trash), then a cursor
// that marks the rest of the folder as already seen so later ticks only pick up new UIDs.
async function runInitial(
  args: {
    db: Db;
    account: SyncAccount;
    owner: AuthUser;
    session: ImapSession;
    signal: AbortSignal;
  },
  folder: { path: string; specialUse: SpecialUse },
  status: { uidValidity: bigint; uidNext: number; highestModseq: bigint | null },
  touched: Set<string>,
): Promise<Result<number, AppError>> {
  const dateWindow = usesDateWindow(folder.specialUse);
  const since = initialWindowStart();
  const listed = dateWindow
    ? await args.session.uidsInRange(folder.path, since, null, args.signal)
    : await args.session.listUids(folder.path, args.signal);
  if (!listed.ok) return listed;

  const uids = [...listed.value].sort((a, b) => a - b);
  const applied = await applyFolderMessages({
    db: args.db,
    account: args.account,
    owner: args.owner,
    session: args.session,
    folder: folder.path,
    uidValidity: status.uidValidity,
    uids,
    signal: args.signal,
  });
  if (!applied.ok) return applied;
  for (const threadId of applied.value.touchedThreadIds) touched.add(threadId);

  await upsertCursor(args.db, {
    accountId: args.account.id,
    folder: folder.path,
    specialUse: folder.specialUse,
    uidValidity: status.uidValidity,
    lastUid: Math.max(status.uidNext - 1, uids.at(-1) ?? 0),
    uidNext: status.uidNext,
    highestModseq: status.highestModseq,
    backfillBefore: dateWindow ? since : null,
    backfillDone: !dateWindow,
    lastListedAt: new Date(),
  });
  return ok(applied.value.applied);
}

function unchanged(
  cursor: FolderCursor,
  status: { uidNext: number; highestModseq: bigint | null },
): boolean {
  if (status.highestModseq === null || cursor.highestModseq === null) return false;
  if (cursor.uidNext !== status.uidNext) return false;
  if (cursor.highestModseq !== status.highestModseq) return false;
  if (cursor.lastListedAt === null) return false;
  return Date.now() - cursor.lastListedAt.getTime() < MAIL_RELIST_MINUTES * 60_000;
}

// One folder of an incremental pass: apply new UIDs, drop locations for vanished UIDs that the
// server no longer lists, then move the cursor. Only new mail is fetched, never the whole folder.
async function runIncremental(
  args: {
    db: Db;
    account: SyncAccount;
    owner: AuthUser;
    session: ImapSession;
    signal: AbortSignal;
  },
  folder: { path: string; specialUse: SpecialUse },
  cursor: FolderCursor,
  status: { uidValidity: bigint; uidNext: number; highestModseq: bigint | null; messages: number },
  touched: Set<string>,
  vanishedThreads: Set<string>,
): Promise<Result<number, AppError>> {
  const listed = await args.session.listUids(folder.path, args.signal);
  if (!listed.ok) return listed;
  const listedSet = new Set(listed.value);
  const maxListed = listed.value.length === 0 ? 0 : Math.max(...listed.value);

  const newUids = listed.value.filter((uid) => uid > cursor.lastUid).sort((a, b) => a - b);
  let applied = 0;
  if (newUids.length > 0) {
    const stored = await applyFolderMessages({
      db: args.db,
      account: args.account,
      owner: args.owner,
      session: args.session,
      folder: folder.path,
      uidValidity: status.uidValidity,
      uids: newUids,
      signal: args.signal,
    });
    if (!stored.ok) return stored;
    applied = stored.value.applied;
    for (const threadId of stored.value.touchedThreadIds) touched.add(threadId);
  }

  // An empty listing on a non-empty folder is a server hiccup, not "everything vanished". On a
  // genuinely empty folder every known location is gone; otherwise only UIDs up to the largest
  // listed one count (a UID above it may just not be visible yet).
  const locations = await folderLocations(
    args.db,
    args.account.id,
    folder.path,
    status.uidValidity,
  );
  const emptyFolder = listed.value.length === 0 && status.messages === 0;
  const vanished =
    listed.value.length === 0 && status.messages > 0
      ? []
      : locations.filter(
          (location) => !listedSet.has(location.uid) && (emptyFolder || location.uid <= maxListed),
        );
  if (vanished.length > 0) {
    const threadIds = await threadIdsFor(
      args.db,
      args.account.id,
      vanished.map((location) => location.providerMessageId),
    );
    for (const threadId of threadIds) vanishedThreads.add(threadId);
    await deleteLocations(
      args.db,
      args.account.id,
      folder.path,
      vanished.map((location) => location.uid),
    );
  }

  await upsertCursor(args.db, {
    ...cursor,
    folder: folder.path,
    specialUse: folder.specialUse,
    uidValidity: status.uidValidity,
    lastUid: Math.max(cursor.lastUid, maxListed),
    uidNext: status.uidNext,
    highestModseq: status.highestModseq,
    lastListedAt: new Date(),
  });
  return ok(applied);
}

// One folder of a pass: initial, UIDVALIDITY reset or incremental, in that order of precedence.
async function syncFolder(
  args: {
    db: Db;
    account: SyncAccount;
    owner: AuthUser;
    session: ImapSession;
    signal: AbortSignal;
  },
  folder: { path: string; specialUse: SpecialUse },
  cursor: FolderCursor | undefined,
  touched: Set<string>,
  vanishedThreads: Set<string>,
  deps: SyncDeps,
): Promise<Result<number, AppError>> {
  const status = await args.session.status(folder.path, args.signal);
  if (!status.ok) return status;

  const reset = cursor !== undefined && cursor.uidValidity !== status.value.uidValidity;
  if (reset) {
    console.warn("[mail.sync] uidvalidity reset", {
      accountId: args.account.id,
      folder: folder.path,
    });
    await deleteFolderState(args.db, args.account.id, folder.path);
  }

  if (reset || cursor === undefined) {
    const initial = await runInitial(args, folder, status.value, touched);
    if (!initial.ok) return initial;
    if (shouldBackfill()) await deps.enqueueBackfill(args.account.id);
    return initial;
  }

  if (unchanged(cursor, status.value)) return ok(0);
  return runIncremental(args, folder, cursor, status.value, touched, vanishedThreads);
}

// Sync every mirrored folder of one IMAP account. Cursors move only after their folder's mail is
// stored; a failure stops the pass with the failing folder's cursor untouched.
export async function syncImapAccount(
  db: Db,
  args: { account: SyncAccount; owner: AuthUser; session: ImapSession; signal: AbortSignal },
  deps: SyncDeps = { enqueueBackfill: defaultEnqueueBackfill },
): Promise<Result<SyncResult, AppError>> {
  args.signal.throwIfAborted();
  const discovered = await discoverFolders(args.session, args.signal);
  if (!discovered.ok) return discovered;
  const folderUse = new Map<string, SpecialUse | null>(
    discovered.value.map((folder) => [folder.path, folder.specialUse]),
  );
  const cursors = new Map((await getCursors(db, args.account.id)).map((row) => [row.folder, row]));
  const touched = new Set<string>();
  const vanishedThreads = new Set<string>();
  let applied = 0;

  for (const folder of discovered.value) {
    args.signal.throwIfAborted();
    const synced = await syncFolder(
      { db, ...args },
      folder,
      cursors.get(folder.path),
      touched,
      vanishedThreads,
      deps,
    );
    if (!synced.ok) return synced;
    applied += synced.value;
  }

  await reconcileTrash(db, args.account.id, [...touched, ...vanishedThreads], folderUse);
  await db.execute(sql`
    UPDATE email_accounts SET last_sync_at = now(), last_error_id = NULL WHERE id = ${args.account.id}
  `);
  args.signal.throwIfAborted();
  return ok({ applied });
}
