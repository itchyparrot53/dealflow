import { sql } from "drizzle-orm";
import { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import type { MailProvider, SentMessage } from "@/features/mail/provider/types";
import { err, ok, type Result } from "@/types/result";

export interface AttemptRow {
  id: string;
  status: string;
  message_id_header: string;
  // Raw SQL returns timestamptz as an ISO string; coerce with new Date(...) on use.
  send_started_at: string | null;
  claim_token: string | null;
  provider_message_id: string | null;
}

export type SendOutcome = {
  status: "sent" | "failed" | "needs_review";
  providerMessageId?: string;
  // Present on a direct send; absent on a replay or reconcile hit, where the caller can ask the
  // provider to describe the message by id.
  sent?: SentMessage;
};

// Flip the row to sent and record the gmail message id. Idempotent and overwrite-safe:
// the WHERE clause adopts an id only when none is set yet, OR when it equals the id
// already stored. A second markSent carrying a DIVERGENT id (e.g. a concurrent worker
// that resolved sendRaw with a different message while another reconciled) is a no-op,
// never a silent overwrite. This is the exactly-once guarantee on the lease-expiry tail.
export async function markSent(
  db: Db,
  attemptId: string,
  providerMessageId: string,
  signal: AbortSignal,
): Promise<void> {
  await db.execute(sql`
    UPDATE email_send_attempts
    SET status='sent', provider_message_id=${providerMessageId}, sent_at=now(), error_id=NULL
    WHERE id=${attemptId}
      AND status <> 'sent'
      AND (provider_message_id IS NULL OR provider_message_id = ${providerMessageId})
  `);
  signal.throwIfAborted();
}

// RECONCILE (crash-after-accept safety): a row already has send_started_at, so a prior
// run may have sent. We search Gmail by the deterministic Message-ID header instead of
// blindly re-sending.
//   - found  -> the prior send DID land; adopt its id and mark sent.
//   - not found, within the reconcile window -> retryable (caller leaves it sending).
//   - not found, window exhausted -> needs_review (E_GMAIL_004): refuse to guess.
export async function reconcile(
  db: Db,
  args: {
    attempt: AttemptRow;
    provider: MailProvider;
    signal: AbortSignal;
    now: number;
    windowMs: number;
  },
): Promise<Result<SendOutcome, AppError>> {
  const found = await args.provider.findSent({
    messageIdHeader: args.attempt.message_id_header,
    signal: args.signal,
  });
  args.signal.throwIfAborted();
  if (!found.ok) return found;

  const hit = found.value;
  if (hit !== null) {
    await markSent(db, args.attempt.id, hit.providerMessageId, args.signal);
    return ok({ status: "sent", providerMessageId: hit.providerMessageId });
  }

  // Not found. The send_started_at timestamp anchors the reconcile deadline. Raw SQL
  // returns it as a string, so coerce to epoch ms defensively.
  const startedAt = args.attempt.send_started_at;
  const startedMs = startedAt !== null ? new Date(startedAt).getTime() : args.now;
  const deadline = startedMs + args.windowMs;
  if (args.now < deadline) {
    // Still settling: Gmail may not have indexed it yet. Retryable, do not advance.
    // This is expected control-flow (E_GMAIL_007), NOT an API failure, so it does not
    // pollute API-exhaustion metrics. NOTE: this within-window retry path is
    // intentionally lease-free: spacing between reconcile attempts relies on the
    // poller cadence, not a DB lease. The reviewer flagged a possible Gmail-search
    // thundering-herd here; we accept it as poller-spaced for now.
    return err(
      new AppError("E_GMAIL_007", "reconcile still settling, retry", {
        attemptId: args.attempt.id,
      }),
    );
  }

  // Window exhausted and still nothing: a human must decide. Never auto-resend.
  await db.execute(sql`
    UPDATE email_send_attempts
    SET status='needs_review', error_id='E_GMAIL_004'
    WHERE id=${args.attempt.id}
  `);
  args.signal.throwIfAborted();
  return ok({ status: "needs_review" });
}
