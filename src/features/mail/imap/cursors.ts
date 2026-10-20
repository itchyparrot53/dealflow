import { and, asc, eq, sql } from "drizzle-orm";
import type { SpecialUse } from "@/constants/mail";
import type { Db } from "@/db/client";
import { mailFolderCursors } from "@/db/schema";

export interface FolderCursor {
  accountId: string;
  folder: string;
  specialUse: SpecialUse | null;
  uidValidity: bigint;
  lastUid: number;
  uidNext: number;
  highestModseq: bigint | null;
  backfillBefore: Date | null;
  backfillDone: boolean;
  lastListedAt: Date | null;
}

export async function getCursors(db: Db, accountId: string): Promise<FolderCursor[]> {
  const rows = await db
    .select()
    .from(mailFolderCursors)
    .where(eq(mailFolderCursors.accountId, accountId))
    .orderBy(asc(mailFolderCursors.folder));
  return rows;
}

// Upsert one folder's cursor. The sync engine only calls this after a folder's messages are
// stored, so a failed fetch never advances the cursor past unstored mail.
export async function upsertCursor(db: Db, row: FolderCursor): Promise<void> {
  await db
    .insert(mailFolderCursors)
    .values(row)
    .onConflictDoUpdate({
      target: [mailFolderCursors.accountId, mailFolderCursors.folder],
      set: {
        specialUse: row.specialUse,
        uidValidity: row.uidValidity,
        lastUid: row.lastUid,
        uidNext: row.uidNext,
        highestModseq: row.highestModseq,
        backfillBefore: row.backfillBefore,
        backfillDone: row.backfillDone,
        lastListedAt: row.lastListedAt,
        updatedAt: new Date(),
      },
    });
}

// A UIDVALIDITY change invalidates every UID we know for that folder: drop the cursor and the
// folder's locations, then the caller runs the initial path again.
export async function deleteFolderState(db: Db, accountId: string, folder: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM mail_message_locations WHERE account_id=${accountId} AND folder=${folder}
  `);
  await db
    .delete(mailFolderCursors)
    .where(and(eq(mailFolderCursors.accountId, accountId), eq(mailFolderCursors.folder, folder)));
}
