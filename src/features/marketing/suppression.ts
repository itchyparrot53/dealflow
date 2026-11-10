import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { MarketingStatus, SuppressionReason } from "@/constants/marketing";
import { marketingSuppressions } from "@/db/schema";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// Suppression is address-based, not person-based: deleting the contact must not let the same
// mailbox be imported again and mailed. Hashing also means a database dump does not expose the
// addresses on the suppression list.

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function suppressionStatusFor(reason: SuppressionReason): MarketingStatus {
  return reason === "hard_bounce" ? "bounced" : "unsubscribed";
}

export async function findSuppression(
  tx: DbOrTx,
  emailHash: string,
  signal: AbortSignal,
): Promise<SuppressionReason | null> {
  signal.throwIfAborted();
  const [row] = await tx
    .select({ reason: marketingSuppressions.reason })
    .from(marketingSuppressions)
    .where(eq(marketingSuppressions.emailHash, emailHash))
    .limit(1);
  signal.throwIfAborted();
  return (row?.reason as SuppressionReason | undefined) ?? null;
}

// First reason wins: an address that unsubscribed and later hard-bounced stays unsubscribed, which
// is the softer and still correct block.
export async function addSuppression(
  tx: DbOrTx,
  emailHash: string,
  reason: SuppressionReason,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await tx.insert(marketingSuppressions).values({ emailHash, reason }).onConflictDoNothing();
  signal.throwIfAborted();
}

export async function removeSuppression(
  tx: DbOrTx,
  emailHash: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await tx.delete(marketingSuppressions).where(eq(marketingSuppressions.emailHash, emailHash));
  signal.throwIfAborted();
}
