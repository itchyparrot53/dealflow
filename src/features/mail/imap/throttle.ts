import { sql } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { err, ok, type Result } from "@/types/result";

const DAY_MS = 24 * 60 * 60 * 1000;

// Rolling 24-hour recipient budget per mailbox. Recipients already counted are the to+cc+bcc
// lengths of attempts marked sent in the window; this message's own recipients come on top. Over
// the limit the send is DEFERRED (rescheduled) rather than failed.
export async function checkDailyQuota(
  db: Db,
  accountId: string,
  recipients: number,
  now: Date,
  limit: number = env.MAIL_SEND_DAILY_RECIPIENTS,
): Promise<Result<void, AppError>> {
  const rows = (
    await db.execute(sql`
      SELECT sent_at,
        COALESCE(jsonb_array_length(payload->'to'), 0)
        + COALESCE(jsonb_array_length(payload->'cc'), 0)
        + COALESCE(jsonb_array_length(payload->'bcc'), 0) AS n
      FROM email_send_attempts
      WHERE account_id=${accountId}
        AND status='sent'
        AND sent_at > ${new Date(now.getTime() - DAY_MS)}
      ORDER BY sent_at ASC
    `)
  ).rows as { sent_at: string | Date; n: number }[];

  const used = rows.reduce((sum, row) => sum + Number(row.n), 0);
  if (used + recipients <= limit) return ok(undefined);

  const oldest = rows[0]?.sent_at;
  const retryAt = new Date(
    (oldest === undefined ? now.getTime() : new Date(oldest).getTime()) + DAY_MS + 60_000,
  );
  return err(
    new AppError(ERROR_IDS.MAIL_SEND_DEFERRED, "daily recipient limit reached", {
      retryAt: retryAt.toISOString(),
    }),
  );
}
