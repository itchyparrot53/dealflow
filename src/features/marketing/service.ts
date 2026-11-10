import { and, eq, isNull } from "drizzle-orm";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  CONSENT_BASES,
  type ConsentBasis,
  type ConsentSource,
  MANUAL_SUBSCRIBE_BASES,
  type MarketingStatus,
} from "@/constants/marketing";
import type { Db } from "@/db/client";
import { consentEvents, personMarketing, persons } from "@/db/schema";
import { emitDomainEvent } from "@/features/events/emit";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { err, ok, type Result } from "@/types/result";
import { impliedBasis, isTransitionAllowed, requiresBasis } from "./status";
import {
  addSuppression,
  findSuppression,
  hashEmail,
  removeSuppression,
  suppressionStatusFor,
} from "./suppression";

// The one write path for consent. Everything (manual, bulk, import, form, double opt-in, bounce,
// unsubscribe) goes through it so the event, the status row, the suppression list and the domain
// event can never drift apart.

export interface TransitionInput {
  personId: string;
  to: MarketingStatus;
  source: ConsentSource;
  // Required for a manual, bulk or imported subscribe (6.2); ignored where the flow proves its own.
  basis?: ConsentBasis | null;
  actorUserId?: string | null;
  campaignId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface TransitionResult {
  status: MarketingStatus;
  changed: boolean;
}

function invalid(message: string, context?: Record<string, unknown>): AppError {
  return new AppError(ERROR_IDS.MARKETING_INPUT_INVALID, message, context);
}

// Runs inside the caller's transaction (form submission, person create, import). The caller owns
// the boundary so the consent row commits or rolls back with the write that caused it.
export async function applyMarketingTransition(
  tx: DbOrTx,
  input: TransitionInput,
  signal: AbortSignal,
): Promise<Result<TransitionResult, AppError>> {
  signal.throwIfAborted();
  const now = input.now ?? new Date();

  const [person] = await tx
    .select({ id: persons.id, email: persons.primaryEmail })
    .from(persons)
    .where(and(eq(persons.id, input.personId), isNull(persons.deletedAt)))
    .limit(1);
  if (person === undefined) {
    return err(
      new AppError(ERROR_IDS.CONTACT_NOT_FOUND, "person not found", { id: input.personId }),
    );
  }
  const email = person.email;
  if (email === null || email.trim() === "") {
    return err(invalid("person has no email address", { personId: input.personId }));
  }
  const emailHash = hashEmail(email);

  const [existing] = await tx
    .select()
    .from(personMarketing)
    .where(eq(personMarketing.personId, input.personId))
    .limit(1);
  const from: MarketingStatus = existing?.status ?? "not_subscribed";

  // A repeat of the current status writes no evidence: the table describes changes, and an event
  // claiming a transition that did not happen would be false consent history.
  if (from === input.to) return ok({ status: from, changed: false });

  if (!isTransitionAllowed(from, input.to, input.source)) {
    return err(
      new AppError(ERROR_IDS.MARKETING_TRANSITION_INVALID, "transition not allowed", {
        from,
        to: input.to,
        source: input.source,
      }),
    );
  }

  const resolvedBasis = resolveBasis(from, input.to, input.source, input.basis ?? null);
  if (resolvedBasis.ok === false) return resolvedBasis;
  const basis = resolvedBasis.value;
  const nextBasis =
    basis ?? (input.to === "not_subscribed" ? null : (existing?.consentBasis ?? null));

  await tx
    .insert(personMarketing)
    .values({
      personId: input.personId,
      status: input.to,
      consentBasis: nextBasis,
      statusChangedAt: now,
    })
    .onConflictDoUpdate({
      target: personMarketing.personId,
      set: { status: input.to, consentBasis: nextBasis, statusChangedAt: now },
    });
  signal.throwIfAborted();

  await tx.insert(consentEvents).values({
    personId: input.personId,
    emailHash,
    fromStatus: from,
    toStatus: input.to,
    source: input.source,
    basis,
    actorUserId: input.actorUserId ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    campaignId: input.campaignId ?? null,
  });
  signal.throwIfAborted();

  if (input.to === "subscribed") {
    await removeSuppression(tx, emailHash, signal);
  } else if (input.to === "unsubscribed") {
    const reason = input.source === "complaint" ? "complaint" : "unsubscribed";
    await addSuppression(tx, emailHash, reason, signal);
  } else if (input.to === "bounced") {
    await addSuppression(tx, emailHash, "hard_bounce", signal);
  }

  await emitDomainEvent(
    tx,
    {
      type: "person.marketing_status_changed",
      entityType: "person",
      entityId: input.personId,
      actorId: input.actorUserId ?? null,
      changes: [{ field: "marketing_status", old: from, new: input.to }],
    },
    signal,
  );
  return ok({ status: input.to, changed: true });
}

// Standalone callers (a server action) get the transaction; in-transaction callers use the
// function above.
export async function transitionMarketingStatus(
  db: Db,
  input: TransitionInput,
  signal: AbortSignal,
): Promise<Result<TransitionResult, AppError>> {
  return db.transaction((tx) => applyMarketingTransition(tx, input, signal));
}

// 6.2 email-change and new-person rule: a suppressed address lands on the suppression status with
// source `system`. This is the one path outside the transition table (the table has no
// not_subscribed -> unsubscribed edge), and it is deliberately read-only about consent: it never
// subscribes anyone.
export async function syncPersonSuppressionForEmail(
  tx: DbOrTx,
  personId: string,
  email: string | null,
  signal: AbortSignal,
): Promise<Result<TransitionResult | null, AppError>> {
  signal.throwIfAborted();
  if (email === null || email.trim() === "") return ok(null);
  const emailHash = hashEmail(email);
  const reason = await findSuppression(tx, emailHash, signal);
  if (reason === null) return ok(null);

  const target = suppressionStatusFor(reason);
  const [existing] = await tx
    .select()
    .from(personMarketing)
    .where(eq(personMarketing.personId, personId))
    .limit(1);
  const from: MarketingStatus = existing?.status ?? "not_subscribed";
  if (from === target) return ok({ status: target, changed: false });

  const now = new Date();
  await tx
    .insert(personMarketing)
    .values({
      personId,
      status: target,
      consentBasis: existing?.consentBasis ?? null,
      statusChangedAt: now,
    })
    .onConflictDoUpdate({
      target: personMarketing.personId,
      set: {
        status: target,
        consentBasis: existing?.consentBasis ?? null,
        statusChangedAt: now,
      },
    });
  await tx.insert(consentEvents).values({
    personId,
    emailHash,
    fromStatus: from,
    toStatus: target,
    source: "system",
  });
  await emitDomainEvent(
    tx,
    {
      type: "person.marketing_status_changed",
      entityType: "person",
      entityId: personId,
      actorId: null,
      changes: [{ field: "marketing_status", old: from, new: target }],
    },
    signal,
  );
  return ok({ status: target, changed: true });
}

// Undo path for an import: put the previous status back without asking the transition table. The
// table describes what a person or operator may do; reverting an import's own edit is bookkeeping,
// and the consent event records it as source `system`.
export async function restoreMarketingStatus(
  db: Db,
  personId: string,
  status: MarketingStatus,
  signal: AbortSignal,
): Promise<Result<{ changed: boolean }, AppError>> {
  signal.throwIfAborted();
  return db.transaction(async (tx) => {
    const [person] = await tx
      .select({ email: persons.primaryEmail })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .limit(1);
    if (person === undefined || person.email === null || person.email.trim() === "") {
      return ok({ changed: false });
    }
    const emailHash = hashEmail(person.email);
    const [existing] = await tx
      .select()
      .from(personMarketing)
      .where(eq(personMarketing.personId, personId))
      .limit(1);
    const from: MarketingStatus = existing?.status ?? "not_subscribed";
    if (from === status) return ok({ changed: false });

    const now = new Date();
    await tx
      .insert(personMarketing)
      .values({
        personId,
        status,
        consentBasis: existing?.consentBasis ?? null,
        statusChangedAt: now,
      })
      .onConflictDoUpdate({
        target: personMarketing.personId,
        set: {
          status,
          consentBasis: existing?.consentBasis ?? null,
          statusChangedAt: now,
        },
      });
    await tx.insert(consentEvents).values({
      personId,
      emailHash,
      fromStatus: from,
      toStatus: status,
      source: "system",
    });
    if (status === "subscribed") {
      await removeSuppression(tx, emailHash, signal);
    } else if (status === "unsubscribed") {
      await addSuppression(tx, emailHash, "unsubscribed", signal);
    } else if (status === "bounced") {
      await addSuppression(tx, emailHash, "hard_bounce", signal);
    }
    await emitDomainEvent(
      tx,
      {
        type: "person.marketing_status_changed",
        entityType: "person",
        entityId: personId,
        actorId: null,
        changes: [{ field: "marketing_status", old: from, new: status }],
      },
      signal,
    );
    return ok({ changed: true });
  });
}

// The basis rules of 6.2, extracted so applyMarketingTransition stays inside the lint complexity
// budget. A direct subscribe needs an evidenced basis; a flow that proves its own supplies it.
function resolveBasis(
  from: MarketingStatus,
  to: MarketingStatus,
  source: ConsentSource,
  supplied: ConsentBasis | null,
): Result<ConsentBasis | null, AppError> {
  if (supplied !== null && !(CONSENT_BASES as readonly ConsentBasis[]).includes(supplied)) {
    return err(invalid("unknown consent basis", { basis: supplied }));
  }
  if (requiresBasis(from, to, source)) {
    if (supplied === null) {
      return err(invalid("a direct subscribe needs a consent basis", { to }));
    }
    if (!(MANUAL_SUBSCRIBE_BASES as readonly ConsentBasis[]).includes(supplied)) {
      return err(
        invalid("a direct subscribe needs an explicit, legitimate-interest or imported basis", {
          basis: supplied,
        }),
      );
    }
  }
  const basis = supplied ?? impliedBasis(to, source);
  return ok(basis);
}
