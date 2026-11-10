import { and, eq, gte, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { AppError } from "@/constants/errorIds";
import {
  PGBOSS_QUEUE_SEQUENCE_SEGMENT,
  PGBOSS_QUEUE_SEQUENCE_TICK,
  SEQUENCE_SEGMENT_CRON,
  SEQUENCE_TICK_CRON,
} from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";
import {
  campaignRecipients,
  campaigns,
  deals,
  emailMessages,
  emailThreads,
  marketingTokens,
  personMarketing,
  persons,
  sequenceEnrollments,
  sequenceSteps,
  sequences,
} from "@/db/schema";
import {
  compileContactFilter,
  PERSON_COLUMN_SQL,
  PERSON_FILTER_CONFIG,
} from "@/features/contacts/contactFilter";
import { hashEmail } from "@/features/marketing/suppression";
import { mintMarketingToken } from "@/features/marketing/tokens";
import type { PermSetUser } from "@/features/permissions/effective";
import { hydrateActor } from "@/server/hydrateActor";
import { ok, type Result } from "@/types/result";
import { resolveSegmentDefinition } from "../segment";
import { type ClaimedRecipient, sendCampaignRows, type TickDeps } from "../send/batch";
import { sendCampaignMail } from "../send/transport";
import { syncSegmentEntries } from "./enroll";
import {
  DEFAULT_SEND_WINDOW,
  nextSendTime,
  type SendWindow,
  type SequenceExit,
  sendWindowSchema,
  sequenceExitSchema,
} from "./model";

// 6.10's scheduler. One pg-boss tick a minute claims due enrollments with a short lease, applies the
// always-on and optional exits, then either advances a wait step, sends an email step through the
// hidden nurture campaign (so tracking and headers are identical), or completes the enrollment.

const CLAIM_LIMIT = 200;
const LEASE_MINUTES = 15;
const RETRY_MINUTES = 5;

export interface SequenceTickDeps {
  send: TickDeps["send"];
  now: () => Date;
}

const DEFAULT_DEPS: SequenceTickDeps = {
  send: sendCampaignMail,
  now: () => new Date(),
};

export interface SequenceTickSummary {
  claimed: number;
  sent: number;
  waited: number;
  completed: number;
  exited: number;
  failed: number;
}

type SendOutcome =
  | { status: "sent" }
  | { status: "retry"; nextAt: Date }
  | { status: "bounced" }
  | { status: "failed" }
  | { status: "skipped"; reason: string };

function parseWindow(value: unknown): SendWindow {
  const parsed = sendWindowSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SEND_WINDOW;
}

function parseExit(value: unknown): SequenceExit {
  const parsed = sequenceExitSchema.safeParse(value);
  return parsed.success ? parsed.data : { dealWon: false, replied: false, filter: null };
}

async function claimDueEnrollments(db: Db, now: Date): Promise<string[]> {
  const lease = new Date(now.getTime() + LEASE_MINUTES * 60_000);
  const result = await db.execute(sql`
    UPDATE sequence_enrollments SET next_run_at = ${lease}
    WHERE id IN (
      SELECT e.id FROM sequence_enrollments e
      JOIN sequences s ON s.id = e.sequence_id
      WHERE e.status = 'active'
        AND e.next_run_at IS NOT NULL
        AND e.next_run_at <= ${now}
        AND s.status = 'active'
      ORDER BY e.next_run_at
      LIMIT ${CLAIM_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  return (result.rows as unknown as { id: string }[]).map((row) => row.id);
}

async function finishEnrollment(
  db: Db,
  enrollmentId: string,
  status: "completed" | "exited" | "failed",
  reason: string | null,
  currentPosition?: number,
): Promise<void> {
  await db
    .update(sequenceEnrollments)
    .set({
      status,
      nextRunAt: null,
      exitReason: reason,
      ...(currentPosition === undefined ? {} : { currentPosition }),
    })
    .where(eq(sequenceEnrollments.id, enrollmentId));
}

async function dealWonExit(
  db: Db,
  personId: string,
  enteredAt: Date,
  signal: AbortSignal,
): Promise<boolean> {
  const [won] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(eq(deals.personId, personId), eq(deals.status, "won"), gte(deals.updatedAt, enteredAt)),
    )
    .limit(1);
  signal.throwIfAborted();
  return won !== undefined;
}

async function repliedExit(
  db: Db,
  personId: string,
  enteredAt: Date,
  signal: AbortSignal,
): Promise<boolean> {
  const [reply] = await db
    .select({ id: emailMessages.id })
    .from(emailMessages)
    .innerJoin(emailThreads, eq(emailThreads.id, emailMessages.threadId))
    .where(
      and(
        eq(emailThreads.personId, personId),
        eq(emailMessages.direction, "inbound"),
        gte(emailMessages.createdAt, enteredAt),
      ),
    )
    .limit(1);
  signal.throwIfAborted();
  return reply !== undefined;
}

async function filterExit(
  db: Db,
  personId: string,
  createdBy: string | null,
  savedFilterId: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (createdBy === null) return false;
  const actor: PermSetUser | null = await hydrateActor(db, createdBy, signal);
  if (actor === null) return false;
  const definition = await resolveSegmentDefinition(
    db,
    actor,
    { kind: "saved_filter", savedFilterId },
    signal,
  );
  if (!definition.ok) return false;
  const filterSql = compileContactFilter(definition.value, PERSON_FILTER_CONFIG, PERSON_COLUMN_SQL);
  const [match] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(filterSql === null ? eq(persons.id, personId) : and(eq(persons.id, personId), filterSql))
    .limit(1);
  signal.throwIfAborted();
  return match !== undefined;
}

async function evaluateExits(
  db: Db,
  input: {
    personId: string;
    enteredAt: Date;
    createdBy: string | null;
    exit: SequenceExit;
  },
  signal: AbortSignal,
): Promise<string | null> {
  if (input.exit.dealWon && (await dealWonExit(db, input.personId, input.enteredAt, signal))) {
    return "deal_won";
  }
  if (input.exit.replied && (await repliedExit(db, input.personId, input.enteredAt, signal))) {
    return "replied";
  }
  if (
    input.exit.filter !== null &&
    (await filterExit(db, input.personId, input.createdBy, input.exit.filter.savedFilterId, signal))
  ) {
    return "in_filter";
  }
  return null;
}

async function loadEnrollment(db: Db, enrollmentId: string, signal: AbortSignal) {
  const [row] = await db
    .select({
      enrollmentId: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      personId: sequenceEnrollments.personId,
      currentPosition: sequenceEnrollments.currentPosition,
      enteredAt: sequenceEnrollments.enteredAt,
      status: sequenceEnrollments.status,
      sequenceStatus: sequences.status,
      sequenceName: sequences.name,
      sequenceCreatedBy: sequences.createdBy,
      sendWindow: sequences.sendWindow,
      exit: sequences.exit,
    })
    .from(sequenceEnrollments)
    .innerJoin(sequences, eq(sequences.id, sequenceEnrollments.sequenceId))
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1);
  signal.throwIfAborted();
  return row ?? null;
}

async function consentStatus(
  db: Db,
  personId: string,
  signal: AbortSignal,
): Promise<{ deleted: boolean; status: string; email: string | null }> {
  const [person] = await db
    .select({ deletedAt: persons.deletedAt, email: persons.primaryEmail })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  signal.throwIfAborted();
  if (person === undefined) return { deleted: true, status: "not_subscribed", email: null };
  const [marketing] = await db
    .select({ status: personMarketing.status })
    .from(personMarketing)
    .where(eq(personMarketing.personId, personId))
    .limit(1);
  signal.throwIfAborted();
  return {
    deleted: person.deletedAt !== null,
    status: marketing?.status ?? "not_subscribed",
    email: person.email,
  };
}

async function processEnrollment(
  db: Db,
  enrollmentId: string,
  now: Date,
  deps: SequenceTickDeps,
  signal: AbortSignal,
): Promise<"sent" | "waited" | "completed" | "exited" | "failed" | "noop"> {
  const row = await loadEnrollment(db, enrollmentId, signal);
  if (row === null || row.status !== "active") return "noop";
  // A pause that lands between claim and processing leaves the enrollment due for reactivation.
  if (row.sequenceStatus !== "active") return "noop";

  const consent = await consentStatus(db, row.personId, signal);
  if (consent.deleted) {
    await finishEnrollment(db, row.enrollmentId, "exited", "person_deleted");
    return "exited";
  }
  if (consent.status !== "subscribed") {
    await finishEnrollment(db, row.enrollmentId, "exited", `status_${consent.status}`);
    return "exited";
  }

  const exit = await evaluateExits(
    db,
    {
      personId: row.personId,
      enteredAt: row.enteredAt,
      createdBy: row.sequenceCreatedBy,
      exit: parseExit(row.exit),
    },
    signal,
  );
  if (exit !== null) {
    await finishEnrollment(db, row.enrollmentId, "exited", exit);
    return "exited";
  }

  const steps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, row.sequenceId))
    .orderBy(sequenceSteps.position);
  signal.throwIfAborted();
  if (row.currentPosition >= steps.length) {
    await finishEnrollment(db, row.enrollmentId, "completed", null, steps.length);
    return "completed";
  }
  const step = steps[row.currentPosition];
  if (step === undefined) {
    await finishEnrollment(db, row.enrollmentId, "completed", null, steps.length);
    return "completed";
  }

  if (step.kind === "wait") {
    const window = parseWindow(row.sendWindow);
    const desired = new Date(now.getTime() + (step.waitMinutes ?? 0) * 60_000);
    await db
      .update(sequenceEnrollments)
      .set({ currentPosition: row.currentPosition + 1, nextRunAt: nextSendTime(desired, window) })
      .where(eq(sequenceEnrollments.id, row.enrollmentId));
    return "waited";
  }

  if (step.campaignId === null) return "failed";
  const outcome = await sendStepEmail(
    db,
    {
      campaignId: step.campaignId,
      personId: row.personId,
      email: consent.email ?? "",
    },
    now,
    deps,
    signal,
  );
  if (outcome.status === "sent") {
    const nextPosition = row.currentPosition + 1;
    if (nextPosition >= steps.length) {
      await finishEnrollment(db, row.enrollmentId, "completed", null, nextPosition);
      return "completed";
    }
    const window = parseWindow(row.sendWindow);
    await db
      .update(sequenceEnrollments)
      .set({
        currentPosition: nextPosition,
        nextRunAt: nextSendTime(new Date(now.getTime() + 60_000), window),
      })
      .where(eq(sequenceEnrollments.id, row.enrollmentId));
    return "sent";
  }
  if (outcome.status === "retry") {
    await db
      .update(sequenceEnrollments)
      .set({ nextRunAt: outcome.nextAt })
      .where(eq(sequenceEnrollments.id, row.enrollmentId));
    return "noop";
  }
  if (outcome.status === "bounced") {
    await finishEnrollment(db, row.enrollmentId, "exited", "bounced");
    return "exited";
  }
  if (outcome.status === "skipped") {
    await finishEnrollment(db, row.enrollmentId, "exited", outcome.reason);
    return "exited";
  }
  await finishEnrollment(db, row.enrollmentId, "failed", "send_failed");
  return "failed";
}

async function sendStepEmail(
  db: Db,
  input: { campaignId: string; personId: string; email: string },
  now: Date,
  deps: SequenceTickDeps,
  signal: AbortSignal,
): Promise<SendOutcome> {
  if (input.email.trim() === "") return { status: "failed" };
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, input.campaignId))
    .limit(1);
  signal.throwIfAborted();
  if (campaign === undefined) return { status: "failed" };

  const minted = mintMarketingToken();
  const emailHash = hashEmail(input.email);
  const [existing] = await db
    .select({ status: campaignRecipients.status })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, input.campaignId),
        eq(campaignRecipients.emailHash, emailHash),
      ),
    )
    .limit(1);
  signal.throwIfAborted();
  if (existing?.status === "sent") return { status: "sent" };
  if (existing?.status === "bounced_hard") return { status: "bounced" };
  if (existing?.status === "failed_soft") return { status: "failed" };
  const [recipient] = await db
    .insert(campaignRecipients)
    .values({
      campaignId: input.campaignId,
      personId: input.personId,
      email: input.email,
      emailHash,
      token: minted.token,
      tokenHash: minted.tokenHash,
    })
    .onConflictDoUpdate({
      target: [campaignRecipients.campaignId, campaignRecipients.emailHash],
      set: {
        status: "queued",
        email: input.email,
        token: minted.token,
        tokenHash: minted.tokenHash,
      },
    })
    .returning({ id: campaignRecipients.id });
  if (recipient === undefined) return { status: "failed" };
  await db
    .insert(marketingTokens)
    .values({
      tokenHash: minted.tokenHash,
      purpose: "unsub",
      personId: input.personId,
      campaignRecipientId: recipient.id,
    })
    .onConflictDoNothing();

  const rows: ClaimedRecipient[] = [
    {
      id: recipient.id,
      person_id: input.personId,
      email: input.email,
      email_hash: emailHash,
      token: minted.token,
    },
  ];
  const sent = await sendCampaignRows(db, campaign, rows, signal, {
    send: deps.send,
    now: () => now,
  });
  signal.throwIfAborted();
  if (!sent.ok) return { status: "failed" };

  const [after] = await db
    .select({ status: campaignRecipients.status, retryAt: campaignRecipients.retryAt })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.id, recipient.id))
    .limit(1);
  signal.throwIfAborted();
  if (after === undefined) return { status: "failed" };
  switch (after.status) {
    case "sent":
      return { status: "sent" };
    case "bounced_hard":
      return { status: "bounced" };
    case "skipped_suppressed":
      return { status: "skipped", reason: "suppressed" };
    case "skipped_status":
      return { status: "skipped", reason: "status_changed" };
    case "failed_soft":
      return { status: "failed" };
    case "queued":
      return {
        status: "retry",
        nextAt: after.retryAt ?? new Date(now.getTime() + RETRY_MINUTES * 60_000),
      };
    default:
      return { status: "retry", nextAt: new Date(now.getTime() + RETRY_MINUTES * 60_000) };
  }
}

export async function runSequenceTick(
  db: Db,
  signal: AbortSignal,
  deps: SequenceTickDeps = DEFAULT_DEPS,
): Promise<Result<SequenceTickSummary, AppError>> {
  const now = deps.now();
  const ids = await claimDueEnrollments(db, now);
  const summary: SequenceTickSummary = {
    claimed: ids.length,
    sent: 0,
    waited: 0,
    completed: 0,
    exited: 0,
    failed: 0,
  };
  for (const id of ids) {
    signal.throwIfAborted();
    try {
      const outcome = await processEnrollment(db, id, now, deps, signal);
      if (outcome !== "noop") summary[outcome] += 1;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      summary.failed += 1;
    }
  }
  return ok(summary);
}

export async function registerSequenceJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_SEQUENCE_TICK);
  await boss.work(PGBOSS_QUEUE_SEQUENCE_TICK, async () => {
    await runSequenceTick(defaultDb, AbortSignal.timeout(120_000)).catch((error: unknown) => {
      console.warn("sequence tick failed", { error });
    });
  });
  await boss.schedule(PGBOSS_QUEUE_SEQUENCE_TICK, SEQUENCE_TICK_CRON);

  await boss.createQueue(PGBOSS_QUEUE_SEQUENCE_SEGMENT);
  await boss.work(PGBOSS_QUEUE_SEQUENCE_SEGMENT, async () => {
    await syncSegmentEntries(defaultDb, AbortSignal.timeout(120_000)).catch((error: unknown) => {
      console.warn("sequence segment scan failed", { error });
    });
  });
  await boss.schedule(PGBOSS_QUEUE_SEQUENCE_SEGMENT, SEQUENCE_SEGMENT_CRON);
}

export { processEnrollment, sendStepEmail };
