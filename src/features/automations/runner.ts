import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgBoss } from "pg-boss";
import { z } from "zod";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { PGBOSS_QUEUE_AUTOMATION_RUN } from "@/constants/jobNames";
import { type Db, db as defaultDb } from "@/db/client";
import type * as schema from "@/db/schema";
import {
  activities,
  automationRuns,
  automations,
  deals,
  documents,
  domainEvents,
  leads,
  users,
} from "@/db/schema";
import { runInChain } from "@/features/events/chainContext";
import type { PermSetUser } from "@/features/permissions/effective";
import { type Action, type AutomationDefinition, automationDefinitionSchema } from "./definition";
// Explicit /index: "./actions" would resolve to the server-actions module actions.ts instead.
import "./actions/index";
import type { DbOrTx } from "@/server/realtime/channelVersions";
import { getActionHandler } from "./actions/registry";
import { type ConditionEntity, evaluateCondition } from "./conditions";

// The Drizzle transaction type, matching dispatcher.ts.
type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

// The automation runner. A run row is created by the dispatcher; this module claims it under a row
// lock so two workers cannot run it, checks the cheap skip reasons (disabled, inactive owner, a
// false condition), then executes the actions in order as the automation's creator inside the
// event chain. The first failed action stops the run.

export interface StepResult {
  ok: boolean;
  errorId?: string;
  detail?: string;
}

export interface StepRecord {
  index: number;
  type: Action["type"];
  ok: boolean;
  errorId?: string;
  detail?: string;
}

export interface ActionContext {
  db: Db;
  actor: PermSetUser;
  automationId: string;
  // The record the event was about and, where one exists, its related deal.
  entityType: string;
  entityId: string;
  dealId: string | null;
  definition: AutomationDefinition;
  signal: AbortSignal;
}

export type ActionExecutor = (
  ctx: ActionContext,
  action: Action,
  index: number,
) => Promise<StepResult>;

export interface RunnerDeps {
  executeAction?: ActionExecutor;
}

export interface RunOutcome {
  status: "succeeded" | "failed" | "skipped" | "noop";
  errorId: string | null;
  steps: StepRecord[];
  skipReason: string | null;
}

interface Target {
  entity: ConditionEntity;
  dealId: string | null;
  // The id the condition is evaluated against; for deal targets this is the deal, for the
  // Part 6 events it is the visitor's person (6.8).
  entityId: string | null;
}

// The run row stores no event type, but it does store the event id. Form and booking runs need
// that distinction to evaluate their condition against the visitor's person, so read the event
// row when it is still retained.
const PERSON_CONDITION_EVENTS: ReadonlySet<string> = new Set([
  "form.submitted",
  "booking.created",
  "booking.cancelled",
]);

async function personTarget(
  db: DbOrTx,
  run: typeof automationRuns.$inferSelect,
): Promise<{ personId: string | null; dealId: string | null } | null> {
  if (run.eventId === null) return null;
  const [event] = await db
    .select({ type: domainEvents.type })
    .from(domainEvents)
    .where(eq(domainEvents.id, run.eventId));
  if (event === undefined || !PERSON_CONDITION_EVENTS.has(event.type)) return null;

  switch (run.entityType) {
    case "person":
      return { personId: run.entityId, dealId: null };
    case "lead": {
      const [row] = await db
        .select({ personId: leads.personId })
        .from(leads)
        .where(eq(leads.id, run.entityId));
      return { personId: row?.personId ?? null, dealId: null };
    }
    case "deal": {
      const [row] = await db
        .select({ personId: deals.personId })
        .from(deals)
        .where(eq(deals.id, run.entityId));
      return { personId: row?.personId ?? null, dealId: run.entityId };
    }
    case "activity": {
      const [row] = await db
        .select({ personId: activities.personId, dealId: activities.dealId })
        .from(activities)
        .where(eq(activities.id, run.entityId));
      return { personId: row?.personId ?? null, dealId: row?.dealId ?? null };
    }
    default:
      return null;
  }
}

async function resolveTarget(db: DbOrTx, run: typeof automationRuns.$inferSelect): Promise<Target> {
  const person = await personTarget(db, run);
  if (person !== null) {
    return { entity: "person", dealId: person.dealId, entityId: person.personId };
  }
  switch (run.entityType) {
    case "deal":
      return { entity: "deal", dealId: run.entityId, entityId: run.entityId };
    case "person":
      return { entity: "person", dealId: null, entityId: run.entityId };
    case "organization":
      return { entity: "organization", dealId: null, entityId: run.entityId };
    case "activity": {
      const [row] = await db
        .select({ dealId: activities.dealId })
        .from(activities)
        .where(eq(activities.id, run.entityId));
      return { entity: "deal", dealId: row?.dealId ?? null, entityId: row?.dealId ?? null };
    }
    case "document":
    case "invoice": {
      const [row] = await db
        .select({ dealId: documents.dealId })
        .from(documents)
        .where(eq(documents.id, run.entityId));
      return { entity: "deal", dealId: row?.dealId ?? null, entityId: row?.dealId ?? null };
    }
    default:
      return { entity: "deal", dealId: null, entityId: null };
  }
}

async function defaultExecutor(ctx: ActionContext, action: Action): Promise<StepResult> {
  const handler = getActionHandler(action.type);
  if (handler === undefined) {
    return {
      ok: false,
      errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED,
      detail: `no handler registered for ${action.type}`,
    };
  }
  return handler(ctx, action);
}

type RunRow = typeof automationRuns.$inferSelect;

async function conditionBlocks(
  db: Tx,
  definition: AutomationDefinition,
  target: Target,
  signal: AbortSignal,
): Promise<boolean> {
  if (definition.condition === null || definition.condition.conditions.length === 0) return false;
  if (target.dealId === null && target.entity === "deal") return true;
  const entityId = target.entityId;
  if (entityId === null) return true;
  return !(await evaluateCondition(db, target.entity, entityId, definition.condition, signal));
}

async function executeSteps(
  ctx: ActionContext,
  definition: AutomationDefinition,
  run: RunRow,
  executeAction: ActionExecutor,
): Promise<{ steps: StepRecord[]; failure: string | null }> {
  const steps: StepRecord[] = [];
  const state: { failure: string | null } = { failure: null };
  await runInChain(
    { chainId: run.chainId, depth: run.depth + 1, automationId: ctx.automationId },
    async () => {
      for (const [index, action] of definition.actions.entries()) {
        ctx.signal.throwIfAborted();
        const result = await executeAction(ctx, action, index);
        steps.push({
          index,
          type: action.type,
          ok: result.ok,
          ...(result.errorId === undefined ? {} : { errorId: result.errorId }),
          ...(result.detail === undefined ? {} : { detail: result.detail }),
        });
        if (!result.ok) {
          state.failure = result.errorId ?? ERROR_IDS.AUTOMATION_ACTION_FAILED;
          break;
        }
      }
    },
  );
  return { steps, failure: state.failure };
}

async function finish(
  db: Tx,
  run: RunRow,
  status: "succeeded" | "failed" | "skipped",
  steps: StepRecord[],
  errorId: string | null,
  skipReason: string | null,
): Promise<void> {
  await db
    .update(automationRuns)
    .set({ status, steps, errorId, skipReason, finishedAt: new Date() })
    .where(eq(automationRuns.id, run.id));
  await db
    .update(automations)
    .set({
      runCount: sql`${automations.runCount} + 1`,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, run.automationId));
}

export async function runAutomation(
  db: Db,
  runId: string,
  signal: AbortSignal,
  deps: RunnerDeps = {},
): Promise<RunOutcome> {
  signal.throwIfAborted();
  const executeAction = deps.executeAction ?? defaultExecutor;

  return db.transaction(async (tx) => {
    // Row lock plus the finished check makes a re-run a no-op; the status is also re-read here
    // because a job may be delivered twice by the queue.
    const [run] = await tx
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.id, runId))
      .for("update");
    if (run === undefined || run.finishedAt !== null) {
      return { status: "noop", errorId: null, steps: [], skipReason: null } satisfies RunOutcome;
    }

    const [automation] = await tx
      .select()
      .from(automations)
      .where(eq(automations.id, run.automationId));
    if (automation === undefined || !automation.enabled) {
      await finish(tx, run, "skipped", [], null, "disabled");
      return {
        status: "skipped",
        errorId: null,
        steps: [],
        skipReason: "disabled",
      } satisfies RunOutcome;
    }

    const [owner] =
      automation.createdBy === null
        ? []
        : await tx
            .select({ id: users.id, isAdmin: users.isAdmin, isActive: users.isActive })
            .from(users)
            .where(eq(users.id, automation.createdBy));
    if (owner === undefined || !owner.isAdmin || !owner.isActive) {
      await finish(tx, run, "skipped", [], null, "owner_inactive");
      return {
        status: "skipped",
        errorId: null,
        steps: [],
        skipReason: "owner_inactive",
      } satisfies RunOutcome;
    }

    const parsed = automationDefinitionSchema.safeParse(automation.definition);
    if (!parsed.success) {
      await finish(tx, run, "failed", [], ERROR_IDS.AUTOMATION_DEFINITION_INVALID, null);
      return {
        status: "failed",
        errorId: ERROR_IDS.AUTOMATION_DEFINITION_INVALID,
        steps: [],
        skipReason: null,
      } satisfies RunOutcome;
    }
    const definition = parsed.data;

    const target = await resolveTarget(tx, run);
    if (await conditionBlocks(tx, definition, target, signal)) {
      await finish(tx, run, "skipped", [], null, "condition_false");
      return {
        status: "skipped",
        errorId: null,
        steps: [],
        skipReason: "condition_false",
      } satisfies RunOutcome;
    }

    const actor: PermSetUser = {
      id: owner.id,
      type: "admin",
      isActive: owner.isActive,
      groupIds: new Set(),
      // Admin bypasses flag checks in `can`, so the empty set is correct here.
      flags: new Set(),
    };
    const ctx: ActionContext = {
      db,
      actor,
      automationId: automation.id,
      entityType: run.entityType,
      entityId: run.entityId,
      dealId: target.dealId,
      definition,
      signal,
    };

    const executed = await executeSteps(ctx, definition, run, executeAction);
    if (executed.failure !== null) {
      await finish(tx, run, "failed", executed.steps, executed.failure, null);
      return {
        status: "failed",
        errorId: executed.failure,
        steps: executed.steps,
        skipReason: null,
      } satisfies RunOutcome;
    }
    await finish(tx, run, "succeeded", executed.steps, null, null);
    return {
      status: "succeeded",
      errorId: null,
      steps: executed.steps,
      skipReason: null,
    } satisfies RunOutcome;
  });
}
const runPayloadSchema = z.object({ runId: z.string().uuid() });

export async function registerAutomationRunner(boss: PgBoss): Promise<void> {
  await boss.createQueue(PGBOSS_QUEUE_AUTOMATION_RUN);
  await boss.work(PGBOSS_QUEUE_AUTOMATION_RUN, async ([job]) => {
    if (job === undefined) return;
    const parsed = runPayloadSchema.safeParse(job.data);
    if (!parsed.success) return;
    try {
      await runAutomation(defaultDb, parsed.data.runId, AbortSignal.timeout(120_000));
    } catch (error) {
      if (error instanceof AppError) {
        console.error(`automations.run ${parsed.data.runId} failed: ${error.id}`);
        return;
      }
      console.error(`automations.run ${parsed.data.runId} threw`, error);
    }
  });
}
