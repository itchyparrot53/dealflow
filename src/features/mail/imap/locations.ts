import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mailMessageLocations } from "@/db/schema";
import type { DbOrTx } from "@/server/realtime/channelVersions";

export interface MessageLocation {
  accountId: string;
  folder: string;
  uidValidity: bigint;
  uid: number;
  providerMessageId: string;
}

// Record that a message lives in a folder at a UID. The primary key makes this a no-op when the
// same message is seen again in the same folder.
export async function upsertLocation(tx: DbOrTx, row: MessageLocation): Promise<void> {
  await tx.insert(mailMessageLocations).values(row).onConflictDoNothing();
}

export async function locationsFor(
  db: Db,
  accountId: string,
  providerMessageIds: string[],
): Promise<{ providerMessageId: string; folder: string; uid: number; uidValidity: bigint }[]> {
  if (providerMessageIds.length === 0) return [];
  return db
    .select({
      providerMessageId: mailMessageLocations.providerMessageId,
      folder: mailMessageLocations.folder,
      uid: mailMessageLocations.uid,
      uidValidity: mailMessageLocations.uidValidity,
    })
    .from(mailMessageLocations)
    .where(
      and(
        eq(mailMessageLocations.accountId, accountId),
        inArray(mailMessageLocations.providerMessageId, providerMessageIds),
      ),
    );
}

export async function folderLocations(
  db: Db,
  accountId: string,
  folder: string,
  uidValidity: bigint,
): Promise<{ uid: number; providerMessageId: string }[]> {
  return db
    .select({
      uid: mailMessageLocations.uid,
      providerMessageId: mailMessageLocations.providerMessageId,
    })
    .from(mailMessageLocations)
    .where(
      and(
        eq(mailMessageLocations.accountId, accountId),
        eq(mailMessageLocations.folder, folder),
        eq(mailMessageLocations.uidValidity, uidValidity),
      ),
    );
}

export async function deleteLocations(
  db: Db,
  accountId: string,
  folder: string,
  uids: number[],
): Promise<void> {
  if (uids.length === 0) return;
  await db
    .delete(mailMessageLocations)
    .where(
      and(
        eq(mailMessageLocations.accountId, accountId),
        eq(mailMessageLocations.folder, folder),
        inArray(mailMessageLocations.uid, uids),
      ),
    );
}
