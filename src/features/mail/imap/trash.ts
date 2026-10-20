import { sql } from "drizzle-orm";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { ok, type Result } from "@/types/result";
import type { ImapSession } from "../transport/types";
import { deleteLocations, upsertLocation } from "./locations";

interface LocatedMessage {
  folder: string;
  uid: number;
  provider_message_id: string;
}

function groupByFolder(rows: LocatedMessage[]): Map<string, LocatedMessage[]> {
  const groups = new Map<string, LocatedMessage[]>();
  for (const row of rows) {
    const list = groups.get(row.folder) ?? [];
    list.push(row);
    groups.set(row.folder, list);
  }
  return groups;
}

interface ThreadLocation {
  folder: string;
  uid: number;
  provider_message_id: string;
}

async function threadLocations(
  db: Db,
  accountId: string,
  providerThreadId: string,
): Promise<{ threadId: string; rows: ThreadLocation[] } | null> {
  const threadRows = (
    await db.execute(sql`
      SELECT id FROM email_threads
      WHERE account_id=${accountId} AND provider_thread_id=${providerThreadId}
    `)
  ).rows as { id: string }[];
  const thread = threadRows[0];
  if (thread === undefined) return null;
  const rows = (
    await db.execute(sql`
      SELECT l.folder, l.uid, l.provider_message_id
      FROM mail_message_locations l
      JOIN email_messages m
        ON m.account_id = l.account_id AND m.provider_message_id = l.provider_message_id
      WHERE m.thread_id=${thread.id} AND l.account_id=${accountId}
    `)
  ).rows as unknown as ThreadLocation[];
  return { threadId: thread.id, rows };
}

async function trashUidValidity(
  session: ImapSession,
  folder: string,
  signal: AbortSignal,
): Promise<Result<bigint, AppError>> {
  const status = await session.status(folder, signal);
  return status.ok ? ok(status.value.uidValidity) : status;
}

async function replaceLocations(
  db: Db,
  accountId: string,
  trashFolder: string,
  uidValidity: bigint,
  rows: ThreadLocation[],
  moved: Map<number, number>,
): Promise<void> {
  for (const row of rows) {
    const newUid = moved.get(row.uid);
    if (newUid === undefined) continue;
    await upsertLocation(db, {
      accountId,
      folder: trashFolder,
      uidValidity,
      uid: newUid,
      providerMessageId: row.provider_message_id,
    });
  }
}

async function moveFolderToTrash(args: {
  db: Db;
  session: ImapSession;
  accountId: string;
  folder: string;
  rows: ThreadLocation[];
  trashFolder: string;
  uidValidity: bigint | null;
  signal: AbortSignal;
}): Promise<Result<bigint | null, AppError>> {
  const uids = args.rows.map((row) => row.uid);
  const moved = await args.session.move(args.folder, uids, args.trashFolder, args.signal);
  if (!moved.ok) return moved;

  let uidValidity = args.uidValidity;
  if (moved.value.size > 0) {
    if (uidValidity === null) {
      const status = await trashUidValidity(args.session, args.trashFolder, args.signal);
      if (!status.ok) return status;
      uidValidity = status.value;
    }
    await replaceLocations(
      args.db,
      args.accountId,
      args.trashFolder,
      uidValidity,
      args.rows,
      moved.value,
    );
  }
  await deleteLocations(args.db, args.accountId, args.folder, uids);
  return ok(uidValidity);
}

// Move every copy of a thread's messages to the mailbox's Trash folder. Locations are replaced
// from the returned UID map; when the server reports no map they are deleted and the next sync
// re-adds them. The local trashed_at stamp belongs to the caller (threadTrash), as for Gmail.
export async function trashImapThread(args: {
  db: Db;
  accountId: string;
  session: ImapSession;
  providerThreadId: string;
  signal: AbortSignal;
}): Promise<Result<void, AppError>> {
  const folders = await args.session.listFolders(args.signal);
  if (!folders.ok) return folders;
  const trashFolder =
    folders.value.find((folder) => folder.specialUse === "trash")?.path ?? "Trash";

  const located = await threadLocations(args.db, args.accountId, args.providerThreadId);
  if (located === null || located.rows.length === 0) return ok(undefined);

  let uidValidity: bigint | null = null;
  for (const [folder, rows] of groupByFolder(located.rows)) {
    if (folder === trashFolder || rows.length === 0) continue;
    const moved = await moveFolderToTrash({
      db: args.db,
      session: args.session,
      accountId: args.accountId,
      folder,
      rows,
      trashFolder,
      uidValidity,
      signal: args.signal,
    });
    if (!moved.ok) return moved;
    uidValidity = moved.value;
  }
  return ok(undefined);
}
