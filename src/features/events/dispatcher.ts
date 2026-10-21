import { eq, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AUTOMATION_MAX_DEPTH, DISPATCH_BATCH } from "@/constants/automations";
import { PGBOSS_QUEUE_AUTOMATION_RUN, PGBOSS_QUEUE_WEBHOOK_DELIVER } from "@/constants/jobNames";
import type { Db } from "@/db/client";
import type * as schema from "@/db/schema";
import {
  automationRuns,
  automations,
  domainEvents,
  webhookDeliveries,
  webhookSubscriptions,
} from "@/db/schema";
import { automationDefinitionSchema, matchesTrigger } from "@/features/automations/definition";
import { getBoss } from "@/jobs/boss";
import { buildEventPayload, loadEventTarget, type SnapshotEvent } from "./snapshot";
import type { DomainEventType, EventChange } from "./types";

// The dispatcher. One transaction claims a bounded, oldest-first batch with SKIP LOCKED so two
// workers never process the same row, fans each event out to matching automations and webhook
// subscriptions, marks the rows processed, and only then enqueues the delayed work.

// The Drizzle transaction type, matching channelVersions.ts: query builders do not type-resolve
// over a Db | Tx union, so transaction-scoped helpers name the tx type directly.
type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

export interface DispatchResult {
  processed: number;
  runsCreated: number;
  runsSkipped: number;
  deliveriesCreated: number;
}

interface ClaimedRow {
  id: number;
  type: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  changes: unknown;
  txid: number;
  chainId: string;
  depth: number;
  automationId: string | null;
  createdAt: Date;
}

interface DispatchEvent extends SnapshotEvent {
  txid: number;
  chainId: string;
  depth: number;
  automationId: string | null;
}

function changesOf(value: unknown): EventChange[] {
  return Array.isArray(value) ? (value as EventChange[]) : [];
}

// One transaction's edits to the same record collapse into one event of that update type: a
// consumer wants "the deal changed", not four rows. Everything else keeps its own row.
function groupRows(rows: ClaimedRow[]): DispatchEvent[] {
  const groups = new Map<string, DispatchEvent>();
  for (const row of rows) {
    const isUpdate = row.type.endsWith(".updated");
    const key = isUpdate
      ? `${row.txid}:${row.entityType}:${row.entityId}:${row.type}`
      : `row:${row.id}`;
    const existing = groups.get(key);
    const changes = changesOf(row.changes);
    if (existing !== undefined) {
      existing.changes = [...existing.changes, ...changes];
      continue;
    }
    groups.set(key, {
      eventId: row.id,
      type: row.type as DomainEventType,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      changes,
      createdAt: row.createdAt,
      txid: row.txid,
      chainId: row.chainId,
      depth: row.depth,
      automationId: row.automationId,
    });
  }
  return [...groups.values()];
}

async function createRuns(
  tx: Tx,
  event: DispatchEvent,
  definitionFor: Map<string, unknown>,
): Promise<{ created: string[]; skipped: number }> {
  const created: string[] = [];
  let skipped = 0;
  const target = await loadEventTarget(tx, event, AbortSignal.timeout(10_000));

  for (const [automationId, definition] of definitionFor) {
    const parsed = automationDefinitionSchema.safeParse(definition);
    if (!parsed.success) continue;
    if (
      !matchesTrigger(parsed.data.trigger, { type: event.type, changes: event.changes, ...target })
    ) {
      continue;
    }

    const base = {
      automationId,
      eventId: event.eventId,
      entityType: event.entityType,
      entityId: event.entityId,
      chainId: event.chainId,
      depth: event.depth,
    };
    if (event.depth > AUTOMATION_MAX_DEPTH) {
      // Too deep: the loop guard still applies, so record at most one skipped row per chain.
      await tx
        .insert(automationRuns)
        .values({ ...base, status: "skipped", skipReason: "depth_limit", finishedAt: new Date() })
        .onConflictDoNothing();
      skipped += 1;
      continue;
    }
    const [run] = await tx
      .insert(automationRuns)
      .values({ ...base, status: "running" })
      .onConflictDoNothing()
      .returning({ id: automationRuns.id });
    if (run === undefined) {
      // A run already exists for this automation, chain and record: that is the loop guard.
      skipped += 1;
      continue;
    }
    created.push(run.id);
  }
  return { created, skipped };
}

export async function dispatchEvents(db: Db, signal: AbortSignal): Promise<DispatchResult> {
  signal.throwIfAborted();
  const createdRuns: string[] = [];
  const createdDeliveries: string[] = [];
  let processed = 0;
  let runsSkipped = 0;

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(domainEvents)
      .where(isNull(domainEvents.processedAt))
      .orderBy(domainEvents.id)
      .limit(DISPATCH_BATCH)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return;

    const enabledAutomations = await tx
      .select({ id: automations.id, definition: automations.definition })
      .from(automations)
      .where(eq(automations.enabled, true));
    const definitionFor = new Map(enabledAutomations.map((row) => [row.id, row.definition]));

    const subscriptions = await tx
      .select({ id: webhookSubscriptions.id, events: webhookSubscriptions.events })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.enabled, true));

    for (const event of groupRows(rows)) {
      const result = await createRuns(tx, event, definitionFor);
      createdRuns.push(...result.created);
      runsSkipped += result.skipped;

      const interested = subscriptions.filter((sub) => sub.events.includes(event.type));
      if (interested.length > 0) {
        const payload = await buildEventPayload(tx, event, signal);
        for (const subscription of interested) {
          const [delivery] = await tx
            .insert(webhookDeliveries)
            .values({
              subscriptionId: subscription.id,
              eventId: event.eventId,
              eventType: event.type,
              payload,
              status: "pending",
            })
            .returning({ id: webhookDeliveries.id });
          if (delivery !== undefined) createdDeliveries.push(delivery.id);
        }
      }
    }

    const ids = rows.map((row) => row.id);
    await tx
      .update(domainEvents)
      .set({ processedAt: new Date() })
      .where(inArray(domainEvents.id, ids));
    processed = rows.length;
  });

  // Enqueue only after the transaction that created the rows has committed, so a worker cannot
  // pick up a run id that does not exist yet.
  const boss = getBoss();
  if (boss !== null) {
    for (const id of createdRuns) await boss.send(PGBOSS_QUEUE_AUTOMATION_RUN, { runId: id });
    for (const id of createdDeliveries) {
      await boss.send(PGBOSS_QUEUE_WEBHOOK_DELIVER, { deliveryId: id });
    }
  }

  return {
    processed,
    runsCreated: createdRuns.length,
    runsSkipped,
    deliveriesCreated: createdDeliveries.length,
  };
}
