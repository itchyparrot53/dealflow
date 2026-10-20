import { sql } from "drizzle-orm";
import type { SpecialUse } from "@/constants/mail";
import type { Db } from "@/db/client";

// Recompute a thread's trashed state from where its messages actually live. A thread whose every
// location is in Junk or Trash is trashed; anything visible (inbox, sent, archive) un-trashes it.
// A thread with no locations at all is left as it is: nothing was deleted, so nothing changed.
export async function reconcileTrash(
  db: Db,
  accountId: string,
  threadIds: string[],
  folderUse: Map<string, SpecialUse | null>,
): Promise<void> {
  for (const threadId of threadIds) {
    const rows = (
      await db.execute(sql`
        SELECT DISTINCT l.folder
        FROM mail_message_locations l
        JOIN email_messages m
          ON m.account_id = l.account_id AND m.provider_message_id = l.provider_message_id
        WHERE m.thread_id=${threadId} AND l.account_id=${accountId}
      `)
    ).rows as { folder: string }[];
    if (rows.length === 0) continue;

    const everyTrashed = rows.every((row) => {
      const use = folderUse.get(row.folder) ?? null;
      return use === "junk" || use === "trash";
    });
    if (everyTrashed) {
      await db.execute(sql`
        UPDATE email_threads SET trashed_at = coalesce(trashed_at, now()) WHERE id=${threadId}
      `);
    } else {
      await db.execute(sql`UPDATE email_threads SET trashed_at = NULL WHERE id=${threadId}`);
    }
  }
}
