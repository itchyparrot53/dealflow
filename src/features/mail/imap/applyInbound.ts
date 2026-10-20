import { and, eq, inArray } from "drizzle-orm";
import { env } from "@/config/env";
import type { AppError } from "@/constants/errorIds";
import { MAIL_BATCH_SIZE } from "@/constants/mail";
import type { Db } from "@/db/client";
import { emailMessages } from "@/db/schema";
import { storeInboundMessage } from "@/features/mail/inbound/storeInbound";
import { parseRawMessage, parseTooLarge } from "@/features/mail/parse/parseRaw";
import { resolveThreadKey } from "@/features/mail/parse/threadKey";
import type { ParsedMailMessage } from "@/features/mail/parse/types";
import type { AuthUser } from "@/features/permissions/types";
import { ok, type Result } from "@/types/result";
import type { ImapSession } from "../transport/types";
import { upsertLocation } from "./locations";

export interface ApplyInboundArgs {
  db: Db;
  account: { id: string; emailAddress: string };
  owner: AuthUser;
  session: ImapSession;
  folder: string;
  uidValidity: bigint;
  uids: number[];
  signal: AbortSignal;
}

export interface ApplyInboundResult {
  applied: number;
  touchedThreadIds: string[];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function parseSource(
  session: ImapSession,
  account: { emailAddress: string },
  folder: string,
  source: { uid: number; size: number; source: Buffer | null },
  signal: AbortSignal,
): Promise<Result<ParsedMailMessage | null, AppError>> {
  if (source.source !== null) {
    return ok(await parseRawMessage(source.source, { ownAddress: account.emailAddress }));
  }
  const headers = await session.fetchHeaderOnly(folder, source.uid, signal);
  if (!headers.ok) return headers;
  if (headers.value === null) return ok(null);
  return ok(await parseTooLarge(headers.value, source.size, { ownAddress: account.emailAddress }));
}

async function messageExists(
  db: Db,
  accountId: string,
  providerMessageId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: emailMessages.id })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.accountId, accountId),
        eq(emailMessages.providerMessageId, providerMessageId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function applyOne(
  args: ApplyInboundArgs,
  source: { uid: number; size: number; source: Buffer | null },
): Promise<Result<{ applied: boolean; threadId: string | undefined }, AppError>> {
  const parsed = await parseSource(args.session, args.account, args.folder, source, args.signal);
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return ok({ applied: false, threadId: undefined });
  const message = parsed.value;

  if (await messageExists(args.db, args.account.id, message.providerMessageId)) {
    await upsertLocation(args.db, {
      accountId: args.account.id,
      folder: args.folder,
      uidValidity: args.uidValidity,
      uid: source.uid,
      providerMessageId: message.providerMessageId,
    });
    return ok({ applied: false, threadId: undefined });
  }

  const stored = await args.db.transaction(async (tx) => {
    const providerThreadId = await resolveThreadKey(tx, {
      accountId: args.account.id,
      ownAddress: args.account.emailAddress,
      parsed: message,
      signal: args.signal,
    });
    const saved = await storeInboundMessage(tx, {
      accountId: args.account.id,
      owner: args.owner,
      providerThreadId,
      parsed: message,
      signal: args.signal,
    });
    await upsertLocation(tx, {
      accountId: args.account.id,
      folder: args.folder,
      uidValidity: args.uidValidity,
      uid: source.uid,
      providerMessageId: message.providerMessageId,
    });
    return saved;
  });
  return ok({ applied: stored.inserted, threadId: stored.threadId });
}

// Store the given UIDs from one folder. A message already known for this account only gains a
// location; a new one is parsed (headers plus a preview when it is too large), threaded and stored
// with its location in one transaction, so a crash cannot leave half a message.
export async function applyFolderMessages(
  args: ApplyInboundArgs,
): Promise<Result<ApplyInboundResult, AppError>> {
  args.signal.throwIfAborted();
  const touched: string[] = [];
  let applied = 0;

  for (let index = 0; index < args.uids.length; index += MAIL_BATCH_SIZE) {
    const batch = args.uids.slice(index, index + MAIL_BATCH_SIZE);
    const fetched = await args.session.fetchSources(
      args.folder,
      batch,
      env.MAIL_MAX_MESSAGE_BYTES,
      args.signal,
    );
    if (!fetched.ok) return fetched;

    for (const source of fetched.value) {
      args.signal.throwIfAborted();
      const one = await applyOne(args, source);
      if (!one.ok) return one;
      if (one.value.applied) applied += 1;
      if (one.value.threadId !== undefined) touched.push(one.value.threadId);
    }
  }

  return ok({ applied, touchedThreadIds: unique(touched) });
}

// Look up which of these provider message ids already exist for the account. Kept for callers
// that need the check without fetching sources (the reconcile paths).
export async function knownMessageIds(
  db: Db,
  accountId: string,
  providerMessageIds: string[],
): Promise<Set<string>> {
  if (providerMessageIds.length === 0) return new Set();
  const rows = await db
    .select({ providerMessageId: emailMessages.providerMessageId })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.accountId, accountId),
        inArray(emailMessages.providerMessageId, providerMessageIds),
      ),
    );
  return new Set(rows.map((row) => row.providerMessageId));
}
