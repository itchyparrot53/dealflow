import { sql } from "drizzle-orm";
import { MAIL_THREAD_FALLBACK_DAYS } from "@/constants/mail";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { hadReplyPrefix, normalizeSubject } from "./subject";
import type { ParsedMailMessage } from "./types";

interface ThreadCandidate {
  provider_thread_id: string;
  subject: string | null;
  participants: string[];
}

function candidatesFor(parsed: ParsedMailMessage): string[] {
  const out: string[] = [];
  for (const value of [parsed.inReplyTo, ...[...parsed.references].reverse()]) {
    if (value !== null && !out.includes(value)) out.push(value);
  }
  return out;
}

// Decide which provider thread a new message belongs to:
// 1. a stored message whose Message-ID is this message's In-Reply-To or one of its References;
// 2. for a reply-looking message only, a thread within 30 days with the same normalised subject
//    that shares a participant other than our own address;
// 3. a new thread keyed by the root Message-ID.
export async function resolveThreadKey(
  tx: DbOrTx,
  args: {
    accountId: string;
    ownAddress: string;
    parsed: ParsedMailMessage;
    signal: AbortSignal;
  },
): Promise<string> {
  const own = args.ownAddress.trim().toLowerCase();
  for (const candidate of candidatesFor(args.parsed)) {
    args.signal.throwIfAborted();
    const hit = (
      await tx.execute(sql`
        SELECT t.provider_thread_id
        FROM email_message_headers h
        JOIN email_messages m ON m.id = h.message_id AND m.account_id = h.account_id
        JOIN email_threads t ON t.id = m.thread_id AND t.account_id = m.account_id
        WHERE h.account_id=${args.accountId} AND h.rfc822_message_id=${candidate}
        LIMIT 1
      `)
    ).rows[0] as { provider_thread_id: string } | undefined;
    if (hit !== undefined) return hit.provider_thread_id;
  }

  const mayFallBack =
    args.parsed.inReplyTo !== null ||
    args.parsed.references.length > 0 ||
    hadReplyPrefix(args.parsed.subject);
  if (!mayFallBack) return rootKey(args.parsed);

  const sentAt = args.parsed.sentAt ?? new Date();
  const threshold = new Date(sentAt.getTime() - MAIL_THREAD_FALLBACK_DAYS * 24 * 60 * 60 * 1000);
  const wantedSubject = normalizeSubject(args.parsed.subject);
  const otherParticipants = new Set(
    args.parsed.participants.map((email) => email.toLowerCase()).filter((email) => email !== own),
  );

  const rows = (
    await tx.execute(sql`
      SELECT t.provider_thread_id, t.subject,
        COALESCE((
          SELECT array_agg(DISTINCT lower(participant)) FROM (
            SELECT m.from_email::text AS participant
            FROM email_messages m WHERE m.thread_id = t.id AND m.account_id = t.account_id
            UNION
            SELECT jsonb_array_elements_text(m.to_emails)
            FROM email_messages m WHERE m.thread_id = t.id AND m.account_id = t.account_id
            UNION
            SELECT jsonb_array_elements_text(m.cc_emails)
            FROM email_messages m WHERE m.thread_id = t.id AND m.account_id = t.account_id
          ) AS participants
        ), '{}'::text[]) AS participants
      FROM email_threads t
      WHERE t.account_id=${args.accountId} AND t.last_message_at > ${threshold}
      ORDER BY t.last_message_at DESC
      LIMIT 500
    `)
  ).rows as unknown as ThreadCandidate[];
  args.signal.throwIfAborted();

  for (const row of rows) {
    if (normalizeSubject(row.subject) !== wantedSubject) continue;
    const sharesParticipant = row.participants.some((email) => otherParticipants.has(email));
    if (sharesParticipant) return row.provider_thread_id;
  }
  return rootKey(args.parsed);
}

function rootKey(parsed: ParsedMailMessage): string {
  return `imap:${parsed.references[0] ?? parsed.inReplyTo ?? parsed.providerMessageId}`;
}
