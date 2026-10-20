import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessionAuthEvents } from "@/db/schema";

export type SessionAuthMethod = "password" | "magic_link" | "invite";

// Records how a session signed in. One row per session: a later sign-in on the same session
// refreshes the method and the timestamp, which is what the recent-link window measures.
export async function recordSessionAuth(
  db: Db,
  sessionId: string,
  method: SessionAuthMethod,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db
    .insert(sessionAuthEvents)
    .values({ sessionId, method })
    .onConflictDoUpdate({
      target: sessionAuthEvents.sessionId,
      set: { method, authenticatedAt: sql`now()` },
    });
  signal.throwIfAborted();
}

// True when this session was created by an emailed link (magic link or invite) in the last 15
// minutes. The mailbox was proved moments ago, so the password can be reset without the old one.
export async function recentLinkSignIn(
  db: Db,
  sessionId: string,
  signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted();
  const [row] = await db
    .select({ sessionId: sessionAuthEvents.sessionId })
    .from(sessionAuthEvents)
    .where(
      and(
        eq(sessionAuthEvents.sessionId, sessionId),
        inArray(sessionAuthEvents.method, ["magic_link", "invite"]),
        gt(sessionAuthEvents.authenticatedAt, sql`now() - interval '15 minutes'`),
      ),
    )
    .limit(1);
  signal.throwIfAborted();
  return row !== undefined;
}
