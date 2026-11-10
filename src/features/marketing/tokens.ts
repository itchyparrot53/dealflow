import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { MarketingTokenPurpose } from "@/constants/marketing";
import { marketingTokens } from "@/db/schema";
import type { DbOrTx } from "@/server/realtime/channelVersions";

// Section 6.3: 24 random bytes in base64url, only the SHA-256 hex is stored. A leaked database
// therefore cannot be turned into working confirm or unsubscribe links.

export interface MintedToken {
  token: string;
  tokenHash: string;
}

export function hashMarketingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function mintMarketingToken(): MintedToken {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashMarketingToken(token) };
}

export interface CreateMarketingTokenInput {
  purpose: MarketingTokenPurpose;
  personId?: string | null;
  campaignRecipientId?: string | null;
  senderId?: string | null;
  // Null is deliberate for unsubscribe tokens: the link in an old email must keep working.
  expiresAt?: Date | null;
}

export async function createMarketingToken(
  tx: DbOrTx,
  input: CreateMarketingTokenInput,
  signal: AbortSignal,
): Promise<MintedToken> {
  signal.throwIfAborted();
  const minted = mintMarketingToken();
  await tx.insert(marketingTokens).values({
    tokenHash: minted.tokenHash,
    purpose: input.purpose,
    personId: input.personId ?? null,
    campaignRecipientId: input.campaignRecipientId ?? null,
    senderId: input.senderId ?? null,
    expiresAt: input.expiresAt ?? null,
  });
  signal.throwIfAborted();
  return minted;
}

export type MarketingTokenRow = typeof marketingTokens.$inferSelect;

export async function findMarketingTokenByValue(
  tx: DbOrTx,
  token: string,
  signal: AbortSignal,
): Promise<MarketingTokenRow | null> {
  signal.throwIfAborted();
  const [row] = await tx
    .select()
    .from(marketingTokens)
    .where(eq(marketingTokens.tokenHash, hashMarketingToken(token)))
    .limit(1);
  signal.throwIfAborted();
  return row ?? null;
}

// Single-use consumption in one guarded UPDATE, so two concurrent confirmations cannot both win.
// Returns null for an unknown, already-used or expired token; callers map that to one error.
export async function consumeMarketingToken(
  tx: DbOrTx,
  token: string,
  now: Date,
  signal: AbortSignal,
): Promise<MarketingTokenRow | null> {
  signal.throwIfAborted();
  const [row] = await tx
    .update(marketingTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(marketingTokens.tokenHash, hashMarketingToken(token)),
        isNull(marketingTokens.usedAt),
        or(isNull(marketingTokens.expiresAt), gt(marketingTokens.expiresAt, now)),
      ),
    )
    .returning();
  signal.throwIfAborted();
  return row ?? null;
}

export async function deleteMarketingToken(
  tx: DbOrTx,
  tokenHash: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await tx.delete(marketingTokens).where(eq(marketingTokens.tokenHash, tokenHash));
  signal.throwIfAborted();
}
