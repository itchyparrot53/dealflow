import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessions } from "@/db/schema";

// Signing out of other sessions is what makes a password change meaningful: a stolen session must
// not survive it. The session that performed the change is kept so the user is not signed out of
// the browser they are using.
export async function revokeOtherSessions(
  db: Db,
  userId: string,
  keepSessionId: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, keepSessionId),
        isNull(sessions.revokedAt),
      ),
    );
  signal.throwIfAborted();
}
