import { eq } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { MarketingStatus } from "@/constants/marketing";
import type { Db } from "@/db/client";
import { campaignRecipients, campaigns, personMarketing, persons } from "@/db/schema";
import { getEmailDesign } from "@/features/email-design/design";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { type DoubleOptInRequestResult, maskEmail, requestDoubleOptIn } from "./doubleOptIn";
import { applyMarketingTransition, transitionMarketingStatus } from "./service";
import { findMarketingTokenByValue } from "./tokens";

// Section 6.3: the preference page behind the mandatory footer link, and the RFC 8058 one-click
// POST. The token is the credential; neither route trusts a person id from the request.

export type UnsubscribeSource = "unsubscribe_link" | "one_click";

export interface UnsubscribeContext {
  companyName: string;
  emailMasked: string;
  status: MarketingStatus | null;
  campaignName: string | null;
  valid: boolean;
}

async function campaignForRecipient(
  db: DbOrTx,
  recipientId: string | null,
  signal: AbortSignal,
): Promise<{ campaignId: string; name: string } | null> {
  if (recipientId === null) return null;
  const [row] = await db
    .select({ campaignId: campaigns.id, name: campaigns.name })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(eq(campaignRecipients.id, recipientId))
    .limit(1);
  signal.throwIfAborted();
  return row ?? null;
}

export async function loadUnsubscribeContext(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<UnsubscribeContext | null> {
  const design = await getEmailDesign(db, signal);
  const row = await findMarketingTokenByValue(db, token, signal);
  if (row === null || row.purpose !== "unsub" || row.personId === null) {
    return {
      companyName: design.displayName,
      emailMasked: "***",
      status: null,
      campaignName: null,
      valid: false,
    };
  }
  const [person] = await db
    .select({ email: persons.primaryEmail })
    .from(persons)
    .where(eq(persons.id, row.personId))
    .limit(1);
  const [marketing] = await db
    .select({ status: personMarketing.status })
    .from(personMarketing)
    .where(eq(personMarketing.personId, row.personId))
    .limit(1);
  const campaign = await campaignForRecipient(db, row.campaignRecipientId, signal);
  return {
    companyName: design.displayName,
    emailMasked:
      person?.email === null || person?.email === undefined ? "***" : maskEmail(person.email),
    status: marketing?.status ?? "not_subscribed",
    campaignName: campaign?.name ?? null,
    valid: true,
  };
}

export interface UnsubscribeOutcome {
  personId: string;
  campaignId: string | null;
}

export async function applyUnsubscribe(
  db: Db,
  token: string,
  input: { source: UnsubscribeSource; ip: string | null; userAgent: string | null; now?: Date },
  signal: AbortSignal,
): Promise<Result<UnsubscribeOutcome, AppError>> {
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const row = await findMarketingTokenByValue(tx, token, signal);
    if (row === null || row.purpose !== "unsub" || row.personId === null) {
      return err(new AppError(ERROR_IDS.MARKETING_TOKEN_INVALID, "unknown unsubscribe link", {}));
    }
    const campaign = await campaignForRecipient(tx, row.campaignRecipientId, signal);
    const transition = await applyMarketingTransition(
      tx,
      {
        personId: row.personId,
        to: "unsubscribed",
        source: input.source,
        ip: input.ip,
        userAgent: input.userAgent,
        campaignId: campaign?.campaignId ?? null,
        now: input.now,
      },
      signal,
    );
    if (!transition.ok) return transition;
    return ok({ personId: row.personId, campaignId: campaign?.campaignId ?? null });
  });
}

// The page's Resubscribe button: back to pending, then a fresh confirmation email. The person
// cannot become subscribed without clicking that link (6.2).
export async function requestResubscribe(
  db: Db,
  token: string,
  signal: AbortSignal,
): Promise<Result<DoubleOptInRequestResult, AppError>> {
  signal.throwIfAborted();
  const row = await findMarketingTokenByValue(db, token, signal);
  if (row === null || row.purpose !== "unsub" || row.personId === null) {
    return err(new AppError(ERROR_IDS.MARKETING_TOKEN_INVALID, "unknown unsubscribe link", {}));
  }
  const [marketing] = await db
    .select({ status: personMarketing.status })
    .from(personMarketing)
    .where(eq(personMarketing.personId, row.personId))
    .limit(1);
  const status: MarketingStatus = marketing?.status ?? "not_subscribed";
  if (status !== "unsubscribed" && status !== "bounced") {
    return err(
      new AppError(
        ERROR_IDS.MARKETING_TRANSITION_INVALID,
        "only an unsubscribed contact can ask to resubscribe",
        {
          status,
        },
      ),
    );
  }

  const transition = await transitionMarketingStatus(
    db,
    { personId: row.personId, to: "pending", source: "preference_page" },
    signal,
  );
  if (!transition.ok) return transition;
  return requestDoubleOptIn(db, row.personId, signal);
}
