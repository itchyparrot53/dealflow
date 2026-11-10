import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  DOI_RESEND_WINDOW_HOURS,
  DOI_TOKEN_TTL_DAYS,
  type MarketingStatus,
} from "@/constants/marketing";
import type { Db } from "@/db/client";
import { marketingTokens, persons } from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import { sendSystemEmail } from "@/features/email-design/sendSystemEmail";
import { err, ok, type Result } from "@/types/result";
import { applyMarketingTransition } from "./service";
import {
  consumeMarketingToken,
  createMarketingToken,
  deleteMarketingToken,
  findMarketingTokenByValue,
} from "./tokens";

// Section 6.3: the confirmation request and its one-use link. Sending is capped per person and
// per install so a form cannot be used as a mail relay.

export type DoubleOptInLimit = "person" | "install" | null;

export interface DoubleOptInRequestResult {
  sent: boolean;
  limited: DoubleOptInLimit;
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

async function countTokensSince(
  db: Db,
  since: Date,
  personId: string | null,
  signal: AbortSignal,
): Promise<number> {
  const conditions = and(
    eq(marketingTokens.purpose, "doi"),
    gte(marketingTokens.createdAt, since),
    personId === null ? undefined : eq(marketingTokens.personId, personId),
  );
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(marketingTokens)
    .where(conditions);
  signal.throwIfAborted();
  return row?.count ?? 0;
}

export async function requestDoubleOptIn(
  db: Db,
  personId: string,
  signal: AbortSignal,
  opts: { now?: Date } = {},
): Promise<Result<DoubleOptInRequestResult, AppError>> {
  signal.throwIfAborted();
  const now = opts.now ?? new Date();

  const [person] = await db
    .select({ name: persons.name, email: persons.primaryEmail })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .limit(1);
  if (person === undefined) {
    return err(new AppError(ERROR_IDS.CONTACT_NOT_FOUND, "person not found", { personId }));
  }
  if (person.email === null || person.email.trim() === "") {
    return err(
      new AppError(ERROR_IDS.MARKETING_INPUT_INVALID, "person has no email address", { personId }),
    );
  }

  // At most one pending request per person per 24 hours (6.3). Counting issued tokens rather than
  // sent messages is the same thing in practice and needs no second table.
  const personSince = new Date(now.getTime() - DOI_RESEND_WINDOW_HOURS * 60 * 60 * 1000);
  const recentForPerson = await countTokensSince(db, personSince, personId, signal);
  if (recentForPerson > 0) return ok({ sent: false, limited: "person" });

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayForInstall = await countTokensSince(db, dayStart, null, signal);
  if (todayForInstall >= env.CAMPAIGN_DOI_DAILY_LIMIT) {
    return ok({ sent: false, limited: "install" });
  }

  const design = await getEmailDesign(db, signal);
  const minted = await createMarketingToken(
    db,
    {
      purpose: "doi",
      personId,
      expiresAt: new Date(now.getTime() + DOI_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    signal,
  );
  const confirmUrl = `${env.BASE_URL.replace(/\/$/, "")}/c/${minted.token}`;

  const sent = await sendSystemEmail(
    db,
    "marketing_double_opt_in",
    person.email,
    {
      "company.name": design.displayName,
      "recipient.name": person.name,
      confirm_url: confirmUrl,
    },
    signal,
  );
  if (!sent.ok) {
    // A failed send must not leave a token behind: it would block the person for 24 hours.
    await deleteMarketingToken(db, minted.tokenHash, signal).catch(() => undefined);
    return sent;
  }
  return ok({ sent: true, limited: null });
}

export interface DoubleOptInConfirmation {
  personId: string;
  status: MarketingStatus;
}

export async function confirmDoubleOptIn(
  db: Db,
  token: string,
  meta: { ip: string | null; userAgent: string | null; now?: Date },
  signal: AbortSignal,
): Promise<Result<DoubleOptInConfirmation, AppError>> {
  signal.throwIfAborted();
  const now = meta.now ?? new Date();

  return db.transaction(async (tx) => {
    const row = await consumeMarketingToken(tx, token, now, signal);
    if (row === null || row.purpose !== "doi" || row.personId === null) {
      return err(
        new AppError(ERROR_IDS.MARKETING_TOKEN_INVALID, "link expired or already used", {}),
      );
    }
    const transition = await applyMarketingTransition(
      tx,
      {
        personId: row.personId,
        to: "subscribed",
        source: "double_opt_in",
        ip: meta.ip,
        userAgent: meta.userAgent,
        now,
      },
      signal,
    );
    if (!transition.ok) return transition;
    return ok({ personId: row.personId, status: transition.value.status });
  });
}

export interface DoubleOptInContext {
  companyName: string;
  emailMasked: string;
  valid: boolean;
}

// Read-only context for GET /c/{token}. GET must never mutate (prefetch scanners), so this does
// not consume the token; the POST does.
export async function loadDoubleOptInContext(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<DoubleOptInContext> {
  const design = await getEmailDesign(db, signal);
  const row = await findMarketingTokenByValue(db, token, signal);
  if (row === null || row.purpose !== "doi" || row.personId === null) {
    return { companyName: design.displayName, emailMasked: "***", valid: false };
  }
  const valid =
    row.usedAt === null && (row.expiresAt === null || row.expiresAt.getTime() > Date.now());
  const [person] = await db
    .select({ email: persons.primaryEmail })
    .from(persons)
    .where(eq(persons.id, row.personId))
    .limit(1);
  return {
    companyName: design.displayName,
    emailMasked:
      person?.email === null || person?.email === undefined ? "***" : maskEmail(person.email),
    valid,
  };
}
