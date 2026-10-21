import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { automationRuns, automations, deals, users } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import type { Action, AutomationDefinition, Trigger } from "./definition";
import { runAutomation } from "./runner";
import {
  createAutomation,
  deleteAutomation,
  duplicateAutomation,
  setAutomationEnabled,
  updateAutomation,
} from "./service";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let regular: PermSetUser;
let inactiveAdminId: string;
let pipelineId: string;
let stageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

beforeAll(async () => {
  h = await makeTestDb();
  const row = await seedUser(h.db, { isAdmin: true, name: "Automation Admin" });
  admin = { id: row.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  const regularRow = await seedUser(h.db, { name: "Regular" });
  regular = {
    id: regularRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
  const inactive = await seedUser(h.db, { isAdmin: true, name: "Inactive Admin" });
  // seedUser does not set isActive; deactivate this one for the owner_inactive case.
  await h.db.update(users).set({ isActive: false }).where(eq(users.id, inactive.id));
  inactiveAdminId = inactive.id;
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

async function seedDeal(value = "100.00"): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Automation deal",
      pipelineId,
      stageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      boardPosition: "0",
      value,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");
  return row;
}

async function seedAutomation(opts: {
  enabled?: boolean;
  createdBy?: string;
  trigger?: Trigger;
  condition?: AutomationDefinition["condition"];
  actions?: Action[];
}): Promise<string> {
  const [row] = await h.db
    .insert(automations)
    .values({
      name: `Automation ${randomUUID().slice(0, 8)}`,
      enabled: opts.enabled ?? true,
      createdBy: opts.createdBy ?? admin.id,
      definition: {
        trigger: opts.trigger ?? { type: "deal.won" },
        condition: opts.condition ?? null,
        actions: opts.actions ?? [{ type: "ai_score_deal" }],
      },
    })
    .returning({ id: automations.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "automation seed failed");
  return row.id;
}

async function seedRun(automationId: string, entityId: string, depth = 0): Promise<string> {
  const [row] = await h.db
    .insert(automationRuns)
    .values({
      automationId,
      entityType: "deal",
      entityId,
      chainId: randomUUID(),
      depth,
      status: "running",
    })
    .returning({ id: automationRuns.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "run seed failed");
  return row.id;
}

async function loadRun(id: string) {
  const [row] = await h.db.select().from(automationRuns).where(eq(automationRuns.id, id));
  return row;
}

describe("runAutomation", () => {
  it("skips a run whose condition is false", async () => {
    const deal = await seedDeal("100.00");
    const automationId = await seedAutomation({
      condition: { conditions: [{ field: "value", op: "gt", value: 999_999 }] },
    });
    const runId = await seedRun(automationId, deal.id);

    const outcome = await runAutomation(h.db, runId, sig());
    expect(outcome.status).toBe("skipped");
    expect(outcome.skipReason).toBe("condition_false");
    const run = await loadRun(runId);
    expect(run?.status).toBe("skipped");
    expect(run?.skipReason).toBe("condition_false");
  });

  it("skips a disabled automation", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({ enabled: false });
    const runId = await seedRun(automationId, deal.id);

    const outcome = await runAutomation(h.db, runId, sig());
    expect(outcome.status).toBe("skipped");
    expect(outcome.skipReason).toBe("disabled");
  });

  it("skips an automation whose creator is no longer an active admin", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({ createdBy: inactiveAdminId });
    const runId = await seedRun(automationId, deal.id);

    const outcome = await runAutomation(h.db, runId, sig());
    expect(outcome.status).toBe("skipped");
    expect(outcome.skipReason).toBe("owner_inactive");
  });

  it("stops at the first failing action and records both the step and the run", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({
      actions: [{ type: "ai_score_deal" }, { type: "ai_summarize_deal" }],
    });
    const runId = await seedRun(automationId, deal.id);
    const calls: string[] = [];

    const outcome = await runAutomation(h.db, runId, sig(), {
      executeAction: async (_ctx, action) => {
        calls.push(action.type);
        return { ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED };
      },
    });

    expect(calls).toEqual(["ai_score_deal"]);
    expect(outcome.status).toBe("failed");
    expect(outcome.errorId).toBe(ERROR_IDS.AUTOMATION_ACTION_FAILED);
    const run = await loadRun(runId);
    expect(run?.status).toBe("failed");
    expect(run?.errorId).toBe(ERROR_IDS.AUTOMATION_ACTION_FAILED);
    expect(run?.steps).toEqual([
      { index: 0, type: "ai_score_deal", ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED },
    ]);
  });

  it("is a no-op when the run is already finished", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({});
    const runId = await seedRun(automationId, deal.id);
    await h.db
      .update(automationRuns)
      .set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(automationRuns.id, runId));
    let calls = 0;

    const outcome = await runAutomation(h.db, runId, sig(), {
      executeAction: async () => {
        calls += 1;
        return { ok: true };
      },
    });

    expect(outcome.status).toBe("noop");
    expect(calls).toBe(0);
  });
});

describe("automation service", () => {
  const definition = {
    trigger: { type: "deal.won" },
    condition: null,
    actions: [{ type: "ai_score_deal" }],
  };

  it("refuses a non-admin", async () => {
    const result = await createAutomation(h.db, regular, { name: "Nope", definition }, sig());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.PERM_DENIED);
  });

  it("creates, updates, enables, duplicates and deletes", async () => {
    const created = await createAutomation(h.db, admin, { name: "Mine", definition }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.enabled).toBe(false);

    const updated = await updateAutomation(
      h.db,
      admin,
      created.value.id,
      { name: "Renamed" },
      sig(),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.name).toBe("Renamed");

    const enabled = await setAutomationEnabled(h.db, admin, created.value.id, true, sig());
    expect(enabled.ok && enabled.value.enabled).toBe(true);

    const copy = await duplicateAutomation(h.db, admin, created.value.id, sig());
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.value.name).toBe("Renamed (copy)");
    expect(copy.value.enabled).toBe(false);

    const removed = await deleteAutomation(h.db, admin, created.value.id, sig());
    expect(removed.ok).toBe(true);
  });

  it("refuses an invalid definition with the input error", async () => {
    const result = await createAutomation(
      h.db,
      admin,
      {
        name: "Bad",
        definition: { trigger: { type: "deal.won" }, condition: null, actions: [] },
      },
      sig(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AUTOMATION_INPUT_INVALID);
  });
});
